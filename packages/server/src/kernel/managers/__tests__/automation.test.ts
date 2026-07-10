import { describe, it, expect, vi } from 'vitest'
import { AutomationManager } from '../automation.js'
import { KernelBus } from '../../bus.js'
import type { AutomationRuleRepository } from '../../../db/repositories/AutomationRuleRepository.js'
import type { SceneManager } from '../scene.js'
import type { Server as SocketIOServer } from 'socket.io'
import type { AutomationRule, EventConfig } from '@ieomlabs/shared'
import { STATE, SYNTHETIC_SIGNAL_KEY } from '@ieomlabs/shared'

function makeRule(overrides: Partial<AutomationRule> = {}): AutomationRule {
  return {
    id: 'r1',
    enabled: true,
    trigger: { source: 'kernel', event: 'scene:changed' },
    action: { kind: 'desktop-notify', cfg: { title: 'hi', body: '' } },
    ...overrides,
  }
}

function setup(rules: AutomationRule[] = [makeRule()], currentState: STATE = STATE.DESKTOP) {
  const repo = { list: vi.fn(() => rules) } as unknown as AutomationRuleRepository & { list: ReturnType<typeof vi.fn> }
  const bus = new KernelBus()
  const io = { emit: vi.fn() } as unknown as SocketIOServer & { emit: ReturnType<typeof vi.fn> }
  const machine = { transition: vi.fn(), currentState } as unknown as SceneManager
  const manager = new AutomationManager(repo, bus, io, machine)
  // AutomationManager dispatches every matched rule by wrapping its action in
  // a synthetic EventConfig and emitting scheduler:fired — the same pipeline
  // Events/Shows/ChatReactions/Twitch use. Actually running that EventConfig
  // through executeConfiguredEvent is scene.ts's job (see scene.ts tests /
  // the action registry), so unit tests here assert on the emitted
  // scheduler:fired frame rather than on a real side effect.
  const fired = vi.fn()
  bus.on('scheduler:fired', fired)
  return { repo, bus, io, machine, manager, fired }
}

/** The single EventAction a scheduler:fired call's synthetic event carries. */
function firedAction(fired: ReturnType<typeof vi.fn>, callIndex = 0) {
  const event = fired.mock.calls[callIndex]?.[0]?.event as EventConfig | undefined
  return event?.actions?.[0]
}

describe('AutomationManager rule cache', () => {
  it('loads rules once on start and never queries the repo during evaluation', () => {
    const { repo, bus, fired, manager } = setup()
    manager.init()
    manager.start()
    expect(repo.list).toHaveBeenCalledTimes(1)

    for (let i = 0; i < 100; i++) {
      bus.emit('scene:changed', { from: 'A', to: 'B' })
    }
    expect(repo.list).toHaveBeenCalledTimes(1)
    expect(fired).toHaveBeenCalledTimes(100)
    manager.stop()
  })

  it('reloads the cache when automation:rules:changed fires', () => {
    const { repo, bus, manager } = setup()
    manager.start()
    expect(repo.list).toHaveBeenCalledTimes(1)

    bus.emit('automation:rules:changed', { ruleId: 'r1' })
    expect(repo.list).toHaveBeenCalledTimes(2)
    manager.stop()
  })

  it('reloads the cache on full config:changed but not section changes', () => {
    const { repo, bus, manager } = setup()
    manager.start()
    expect(repo.list).toHaveBeenCalledTimes(1)

    bus.emit('config:changed', { section: 'scenes' })
    expect(repo.list).toHaveBeenCalledTimes(1)

    bus.emit('config:changed', { section: 'all' })
    expect(repo.list).toHaveBeenCalledTimes(2)
    manager.stop()
  })

  it('keeps the previous cache when a reload fails', () => {
    const rules = [makeRule()]
    const { repo, bus, fired, manager } = setup(rules)
    manager.start()

    repo.list.mockImplementation(() => { throw new Error('db gone') })
    bus.emit('automation:rules:changed', {})

    bus.emit('scene:changed', { from: 'A', to: 'B' })
    expect(firedAction(fired)).toEqual({ kind: 'desktop-notify', cfg: { title: 'hi', body: '' } })
    manager.stop()
  })

  it('stops evaluating and reloading after stop()', () => {
    const { repo, bus, fired, manager } = setup()
    manager.start()
    manager.stop()

    bus.emit('automation:rules:changed', {})
    bus.emit('scene:changed', { from: 'A', to: 'B' })
    expect(repo.list).toHaveBeenCalledTimes(1)
    expect(fired).not.toHaveBeenCalled()
  })

  it('skips disabled rules and non-matching events from the cache', () => {
    const rules = [
      makeRule({ id: 'r1', enabled: false }),
      makeRule({ id: 'r2', trigger: { source: 'kernel', event: 'overlay:connected', match: { socketId: 'x' } } }),
    ]
    const { bus, fired, manager } = setup(rules)
    manager.start()

    bus.emit('scene:changed', { from: 'A', to: 'B' })
    expect(fired).not.toHaveBeenCalled()

    bus.emit('overlay:connected', { socketId: 'y' })
    expect(fired).not.toHaveBeenCalled()

    bus.emit('overlay:connected', { socketId: 'x' })
    expect(firedAction(fired)).toEqual({ kind: 'desktop-notify', cfg: { title: 'hi', body: '' } })
    manager.stop()
  })
})

describe('AutomationManager widget-trigger rules', () => {
  it('matches widget:signal frames on event + source widget', () => {
    const rules = [
      makeRule({ id: 'r1', trigger: { source: 'widget', event: 'quest:complete', widgetId: 'stream-quest' } }),
    ]
    const { bus, fired, manager } = setup(rules)
    manager.start()

    bus.emit('widget:signal', { source: 'other-widget', event: 'quest:complete', payload: {} })
    expect(fired).not.toHaveBeenCalled()

    bus.emit('widget:signal', { source: 'stream-quest', event: 'quest:complete', payload: {} })
    expect(firedAction(fired)).toEqual({ kind: 'desktop-notify', cfg: { title: 'hi', body: '' } })
    manager.stop()
  })

  it('matches any source when widgetId is omitted and applies payload match', () => {
    const rules = [
      makeRule({ id: 'r1', trigger: { source: 'widget', event: 'weather:storm', match: { severity: 'high' } } }),
    ]
    const { bus, fired, manager } = setup(rules)
    manager.start()

    bus.emit('widget:signal', { source: 'weather', event: 'weather:storm', payload: { severity: 'low' } })
    expect(fired).not.toHaveBeenCalled()

    bus.emit('widget:signal', { source: 'weather', event: 'weather:storm', payload: { severity: 'high' } })
    expect(firedAction(fired)).toEqual({ kind: 'desktop-notify', cfg: { title: 'hi', body: '' } })
    manager.stop()
  })

  it('enforces the sceneIs gate against the current machine state', () => {
    const rules = [
      makeRule({ id: 'r1', trigger: { source: 'widget', event: 'quest:complete', sceneIs: ['CUSTOM_SCENE'] } }),
    ]
    const { bus, fired, manager } = setup(rules, STATE.DESKTOP)
    manager.start()

    bus.emit('widget:signal', { source: 'q', event: 'quest:complete', payload: {} })
    expect(fired).not.toHaveBeenCalled()
    manager.stop()
  })

  it('dispatches widget-command rules (open/close/toggle) through scheduler:fired', () => {
    const rules = [
      makeRule({
        id: 'r1',
        trigger: { source: 'widget', event: 'weather:storm' },
        action: { kind: 'widget-command', widgetId: 'gallery', action: 'open' },
      }),
    ]
    const { bus, fired, manager } = setup(rules)
    manager.start()

    bus.emit('widget:signal', { source: 'weather', event: 'weather:storm', payload: {} })
    expect(firedAction(fired)).toEqual({ kind: 'widget-command', widgetId: 'gallery', action: 'open' })
    manager.stop()
  })

  it('signal-emit rules are blocked from firing off an already-synthetic signal (single-hop guard)', () => {
    const rules = [
      makeRule({
        id: 'r2',
        trigger: { source: 'widget', event: 'party:time' },
        action: { kind: 'signal-emit', cfg: { event: 'party:overflow' } },
      }),
      makeRule({
        id: 'r3',
        trigger: { source: 'widget', event: 'party:time' },
        action: { kind: 'desktop-notify', cfg: { title: 'party', body: '' } },
      }),
    ]
    const { bus, fired, manager } = setup(rules)
    manager.start()

    // A signal already marked synthetic (as signal-emit's own handler marks
    // its output — see builtinActions.ts) must not trigger r2 (another
    // signal-emit), but r3 (a different action kind) still fires normally.
    bus.emit('widget:signal', { source: 'automation', event: 'party:time', payload: { [SYNTHETIC_SIGNAL_KEY]: true } })

    expect(fired).toHaveBeenCalledTimes(1)
    expect(firedAction(fired)).toEqual({ kind: 'desktop-notify', cfg: { title: 'party', body: '' } })
    manager.stop()
  })
})

describe('AutomationManager stateful conditions', () => {
  it('cooldownMs suppresses immediate refires of the same rule', () => {
    const rules = [makeRule({ trigger: { source: 'kernel', event: 'scene:changed', cooldownMs: 60_000 } })]
    const { bus, fired, manager } = setup(rules)
    manager.start()

    bus.emit('scene:changed', { from: 'A', to: 'B' })
    bus.emit('scene:changed', { from: 'B', to: 'A' })
    bus.emit('scene:changed', { from: 'A', to: 'B' })

    expect(fired).toHaveBeenCalledTimes(1)
    manager.stop()
  })

  it('everyN fires only on every Nth match', () => {
    const rules = [makeRule({ trigger: { source: 'kernel', event: 'scene:changed', everyN: 3 } })]
    const { bus, fired, manager } = setup(rules)
    manager.start()

    for (let i = 0; i < 7; i++) bus.emit('scene:changed', { from: 'A', to: 'B' })

    expect(fired).toHaveBeenCalledTimes(2) // 3rd and 6th
    manager.stop()
  })

  it('windowCount fires once N matches land inside the window, then restarts', () => {
    const rules = [makeRule({ trigger: { source: 'kernel', event: 'scene:changed', windowCount: 3, windowMs: 60_000 } })]
    const { bus, fired, manager } = setup(rules)
    manager.start()

    for (let i = 0; i < 5; i++) bus.emit('scene:changed', { from: 'A', to: 'B' })

    // fires on the 3rd (window clears), not yet again by the 5th
    expect(fired).toHaveBeenCalledTimes(1)
    bus.emit('scene:changed', { from: 'A', to: 'B' })
    expect(fired).toHaveBeenCalledTimes(2)
    manager.stop()
  })

  it('stateful conditions on one rule never affect another rule', () => {
    const rules = [
      makeRule({ id: 'gated', trigger: { source: 'kernel', event: 'scene:changed', cooldownMs: 60_000 } }),
      makeRule({ id: 'free', trigger: { source: 'kernel', event: 'scene:changed' } }),
    ]
    const { bus, fired, manager } = setup(rules)
    manager.start()

    bus.emit('scene:changed', { from: 'A', to: 'B' })
    bus.emit('scene:changed', { from: 'B', to: 'A' })

    // gated fired once, free fired twice
    expect(fired).toHaveBeenCalledTimes(3)
    manager.stop()
  })
})
