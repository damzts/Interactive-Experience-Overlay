import { describe, it, expect } from 'vitest'
import { createNavMemory } from '../useNavMemory'

// Tests exercise createNavMemory directly — no React renderer required.
// The useNavMemory hook is a thin wrapper that calls createNavMemory once via
// useRef; the logic under test is identical.

describe('createNavMemory / useNavMemory', () => {
  it('returns null for an unknown section', () => {
    const mem = createNavMemory()
    expect(mem.recall('unknown')).toBeNull()
  })

  it('recalls a remembered item', () => {
    const mem = createNavMemory()
    mem.remember('integrations', { kind: 'obs' })
    expect(mem.recall('integrations')).toEqual({ kind: 'obs' })
  })

  it('overwrites a previously remembered item', () => {
    const mem = createNavMemory()
    mem.remember('integrations', { kind: 'obs' })
    mem.remember('integrations', { kind: 'twitch' })
    expect(mem.recall('integrations')).toEqual({ kind: 'twitch' })
  })

  it('stores sections independently', () => {
    const mem = createNavMemory()
    mem.remember('integrations', { kind: 'obs' })
    mem.remember('settings-tab', { kind: 'settings' })
    expect(mem.recall('integrations')).toEqual({ kind: 'obs' })
    expect(mem.recall('settings-tab')).toEqual({ kind: 'settings' })
  })

  it('recalls items with payload fields', () => {
    const mem = createNavMemory()
    mem.remember('scenes', { kind: 'scene', sceneState: 'SCENE_123' })
    expect(mem.recall('scenes')).toEqual({ kind: 'scene', sceneState: 'SCENE_123' })
  })

  it('returns null for a section that was never remembered', () => {
    const mem = createNavMemory()
    mem.remember('integrations', { kind: 'ai' })
    expect(mem.recall('scenes')).toBeNull()
  })

  it('each createNavMemory call is independent', () => {
    const mem1 = createNavMemory()
    const mem2 = createNavMemory()
    mem1.remember('integrations', { kind: 'obs' })
    expect(mem2.recall('integrations')).toBeNull()
  })
})
