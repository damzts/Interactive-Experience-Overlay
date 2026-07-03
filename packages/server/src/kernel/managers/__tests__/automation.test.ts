import { describe, it, expect, vi } from 'vitest'
import { AutomationManager } from '../automation.js'
import { KernelBus } from '../../bus.js'
import type { AutomationRuleRepository } from '../../../db/repositories/AutomationRuleRepository.js'
import type { SceneManager } from '../scene.js'
import type { Server as SocketIOServer } from 'socket.io'
import type { AutomationRule } from '@ieomlabs/shared'
import { STATE, SYNTHETIC_SIGNAL_KEY } from '@ieomlabs/shared'

function makeRule(overrides: Partial<AutomationRule> = {}): AutomationRule {
  return {
    id: 'r1',
    enabled: true,
    trigger: { source: 'kernel', event: 'scene:changed' },
    action: { kind: 'desktop:notify', params: { title: 'hi' } },
    ...overrides,
  }
}

function setup(rules: AutomationRule[] = [makeRule()], currentState: STATE = STATE.DESKTOP) {
  const repo = { list: vi.fn(() => rules) } as unknown as AutomationRuleRepository & { list: ReturnType<typeof vi.fn> }
  const bus = new KernelBus()
  const io = { emit: vi.fn() } as unknown as SocketIOServer & { emit: ReturnType<typeof vi.fn> }
  const machine = { transition: vi.fn(), currentState } as unknown as SceneManager
  const manager = new AutomationManager(repo, bus, io, machine)
  return { repo, bus, io, machine, manager }
}

describe('AutomationManager rule cache', () => {
  it('loads rules once on start and never queries the repo during evaluation', () => {
    const { repo, bus, io, manager } = setup()
    manager.init()
    manager.start()
    expect(repo.list).toHaveBeenCalledTimes(1)

    for (let i = 0; i < 100; i++) {
      bus.emit('scene:changed', { from: 'A', to: 'B' })
    }
    expect(repo.list).toHaveBeenCalledTimes(1)
    expect(io.emit).toHaveBeenCalledTimes(100)
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
    const { repo, bus, io, manager } = setup(rules)
    manager.start()

    repo.list.mockImplementation(() => { throw new Error('db gone') })
    bus.emit('automation:rules:changed', {})

    bus.emit('scene:changed', { from: 'A', to: 'B' })
    expect(io.emit).toHaveBeenCalledWith('desktop:notify', { title: 'hi' })
    manager.stop()
  })

  it('stops evaluating and reloading after stop()', () => {
    const { repo, bus, io, manager } = setup()
    manager.start()
    manager.stop()

    bus.emit('automation:rules:changed', {})
    bus.emit('scene:changed', { from: 'A', to: 'B' })
    expect(repo.list).toHaveBeenCalledTimes(1)
    expect(io.emit).not.toHaveBeenCalled()
  })

  it('skips disabled rules and non-matching events from the cache', () => {
    const rules = [
      makeRule({ id: 'r1', enabled: false }),
      makeRule({ id: 'r2', trigger: { source: 'kernel', event: 'overlay:connected', match: { socketId: 'x' } } }),
    ]
    const { bus, io, manager } = setup(rules)
    manager.start()

    bus.emit('scene:changed', { from: 'A', to: 'B' })
    expect(io.emit).not.toHaveBeenCalled()

    bus.emit('overlay:connected', { socketId: 'y' })
    expect(io.emit).not.toHaveBeenCalled()

    bus.emit('overlay:connected', { socketId: 'x' })
    expect(io.emit).toHaveBeenCalledWith('desktop:notify', { title: 'hi' })
    manager.stop()
  })
})

describe('AutomationManager widget-trigger rules', () => {
  it('matches widget:signal frames on event + source widget', () => {
    const rules = [
      makeRule({ id: 'r1', trigger: { source: 'widget', event: 'quest:complete', widgetId: 'stream-quest' } }),
    ]
    const { bus, io, manager } = setup(rules)
    manager.start()

    bus.emit('widget:signal', { source: 'other-widget', event: 'quest:complete', payload: {} })
    expect(io.emit).not.toHaveBeenCalled()

    bus.emit('widget:signal', { source: 'stream-quest', event: 'quest:complete', payload: {} })
    expect(io.emit).toHaveBeenCalledWith('desktop:notify', { title: 'hi' })
    manager.stop()
  })

  it('matches any source when widgetId is omitted and applies payload match', () => {
    const rules = [
      makeRule({ id: 'r1', trigger: { source: 'widget', event: 'weather:storm', match: { severity: 'high' } } }),
    ]
    const { bus, io, manager } = setup(rules)
    manager.start()

    bus.emit('widget:signal', { source: 'weather', event: 'weather:storm', payload: { severity: 'low' } })
    expect(io.emit).not.toHaveBeenCalled()

    bus.emit('widget:signal', { source: 'weather', event: 'weather:storm', payload: { severity: 'high' } })
    expect(io.emit).toHaveBeenCalledWith('desktop:notify', { title: 'hi' })
    manager.stop()
  })

  it('enforces the sceneIs gate against the current machine state', () => {
    const rules = [
      makeRule({ id: 'r1', trigger: { source: 'widget', event: 'quest:complete', sceneIs: [STATE.LOBBY] } }),
    ]
    const { bus, io, manager } = setup(rules, STATE.DESKTOP)
    manager.start()

    bus.emit('widget:signal', { source: 'q', event: 'quest:complete', payload: {} })
    expect(io.emit).not.toHaveBeenCalled()
    manager.stop()
  })

  it('executes authoritative open/close/toggle widget:action rules via the runtime delegate', () => {
    const rules = [
      makeRule({
        id: 'r1',
        trigger: { source: 'widget', event: 'weather:storm' },
        action: { kind: 'widget:action', params: { targetWidgetId: 'gallery', action: 'open' } },
      }),
      makeRule({
        id: 'r2',
        trigger: { source: 'widget', event: 'weather:storm' },
        action: { kind: 'widget:action', params: { targetWidgetId: 'gallery', action: 'gallery:next' } },
      }),
    ]
    const { bus, io, manager } = setup(rules)
    const runtime = { setOpen: vi.fn(), toggle: vi.fn() }
    manager.setWidgetRuntime(runtime)
    manager.start()

    bus.emit('widget:signal', { source: 'weather', event: 'weather:storm', payload: {} })
    expect(runtime.setOpen).toHaveBeenCalledWith('gallery', true)
    // Custom actions are the overlay's job — nothing emitted for r2
    expect(io.emit).not.toHaveBeenCalled()
    manager.stop()
  })

  it('signal:emit mints a synthetic signal on the bus and socket, single-hop only', () => {
    const rules = [
      makeRule({
        id: 'r1',
        trigger: { source: 'widget', event: 'quest:complete' },
        action: { kind: 'signal:emit', params: { event: 'party:time', payload: { mood: 'hype' } } },
      }),
      makeRule({
        id: 'r2',
        trigger: { source: 'widget', event: 'party:time' },
        action: { kind: 'signal:emit', params: { event: 'party:overflow' } },
      }),
      makeRule({
        id: 'r3',
        trigger: { source: 'widget', event: 'party:time' },
        action: { kind: 'desktop:notify', params: { title: 'party' } },
      }),
    ]
    const { bus, io, manager } = setup(rules)
    manager.start()

    const seen: string[] = []
    bus.on('widget:signal', (p: { event: string }) => { seen.push(p.event) })

    bus.emit('widget:signal', { source: 'q', event: 'quest:complete', payload: {} })

    // r1 minted party:time; r3 reacted to it; r2 (signal:emit on a synthetic) was blocked
    expect(seen).toContain('party:time')
    expect(seen).not.toContain('party:overflow')
    expect(io.emit).toHaveBeenCalledWith('widget:signal', expect.objectContaining({
      event: 'party:time',
      payload: expect.objectContaining({ mood: 'hype', [SYNTHETIC_SIGNAL_KEY]: true }),
    }))
    expect(io.emit).toHaveBeenCalledWith('desktop:notify', { title: 'party' })
    manager.stop()
  })
})
