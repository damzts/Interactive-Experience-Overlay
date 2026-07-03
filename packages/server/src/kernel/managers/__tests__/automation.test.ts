import { describe, it, expect, vi } from 'vitest'
import { AutomationManager } from '../automation.js'
import { KernelBus } from '../../bus.js'
import type { AutomationRuleRepository } from '../../../db/repositories/AutomationRuleRepository.js'
import type { SceneManager } from '../scene.js'
import type { Server as SocketIOServer } from 'socket.io'
import type { AutomationRule } from '@ieomlabs/shared'

function makeRule(overrides: Partial<AutomationRule> = {}): AutomationRule {
  return {
    id: 'r1',
    enabled: true,
    condition: { event: 'scene:changed' },
    action: { kind: 'desktop:notify', params: { title: 'hi' } },
    ...overrides,
  }
}

function setup(rules: AutomationRule[] = [makeRule()]) {
  const repo = { list: vi.fn(() => rules) } as unknown as AutomationRuleRepository & { list: ReturnType<typeof vi.fn> }
  const bus = new KernelBus()
  const io = { emit: vi.fn() } as unknown as SocketIOServer & { emit: ReturnType<typeof vi.fn> }
  const machine = { transition: vi.fn() } as unknown as SceneManager
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
      makeRule({ id: 'r2', condition: { event: 'overlay:connected', match: { socketId: 'x' } } }),
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
