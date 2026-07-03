import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** The registry keeps module-level budget state, so each test gets a fresh copy. */
async function loadRegistry() {
  vi.resetModules()
  return await import('../registry')
}

describe('effect dispatch registry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('dispatches to the registered handler with the cfg', async () => {
    const { registerEffect, dispatchEffect } = await loadRegistry()
    const handler = vi.fn()
    registerEffect('boom', handler)

    dispatchEffect('boom', { duration: 1 })

    expect(handler).toHaveBeenCalledOnce()
    expect(handler).toHaveBeenCalledWith({ duration: 1 })
  })

  it('warns and does nothing for an unknown effect type', async () => {
    const { dispatchEffect } = await loadRegistry()

    expect(() => dispatchEffect('nope', {})).not.toThrow()
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('no handler registered'))
  })

  it('replaceEffect hot-swaps the handler', async () => {
    const { registerEffect, replaceEffect, dispatchEffect } = await loadRegistry()
    const first = vi.fn()
    const second = vi.fn()
    registerEffect('swap', first)
    replaceEffect('swap', second)

    dispatchEffect('swap', {})

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledOnce()
  })

  it('caps concurrent instances of one type at 3', async () => {
    const { registerEffect, dispatchEffect } = await loadRegistry()
    const handler = vi.fn()
    registerEffect('confetti', handler)

    for (let i = 0; i < 5; i++) dispatchEffect('confetti', { duration: 10 })

    expect(handler).toHaveBeenCalledTimes(3)
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('per-type cap'))
  })

  it('frees per-type budget once instances expire via cfg.duration', async () => {
    const { registerEffect, dispatchEffect } = await loadRegistry()
    const handler = vi.fn()
    registerEffect('confetti', handler)

    for (let i = 0; i < 3; i++) dispatchEffect('confetti', { duration: 2 })
    dispatchEffect('confetti', { duration: 2 })
    expect(handler).toHaveBeenCalledTimes(3)

    vi.advanceTimersByTime(2_100)
    dispatchEffect('confetti', { duration: 2 })
    expect(handler).toHaveBeenCalledTimes(4)
  })

  it('assumes a default lifetime when cfg has no numeric duration', async () => {
    const { registerEffect, dispatchEffect } = await loadRegistry()
    const handler = vi.fn()
    registerEffect('toast', handler)

    for (let i = 0; i < 3; i++) dispatchEffect('toast', {})

    vi.advanceTimersByTime(3_900)
    dispatchEffect('toast', {})
    expect(handler).toHaveBeenCalledTimes(3) // still within the 4s default

    vi.advanceTimersByTime(200)
    dispatchEffect('toast', {})
    expect(handler).toHaveBeenCalledTimes(4)
  })

  it('clamps absurd durations so a bad config cannot pin the budget', async () => {
    const { registerEffect, dispatchEffect } = await loadRegistry()
    const handler = vi.fn()
    registerEffect('stuck', handler)

    for (let i = 0; i < 3; i++) dispatchEffect('stuck', { duration: 99_999 })

    vi.advanceTimersByTime(30_100) // past the 30s tracking ceiling
    dispatchEffect('stuck', { duration: 99_999 })
    expect(handler).toHaveBeenCalledTimes(4)
  })

  it('enforces the global budget of 12 across all types', async () => {
    const { registerEffect, dispatchEffect } = await loadRegistry()
    const handlers = new Map<string, ReturnType<typeof vi.fn>>()
    for (let t = 0; t < 5; t++) {
      const handler = vi.fn()
      handlers.set(`fx-${t}`, handler)
      registerEffect(`fx-${t}`, handler)
    }

    // Fill the global budget: 4 types × 3 instances = 12
    for (let t = 0; t < 4; t++) {
      for (let i = 0; i < 3; i++) dispatchEffect(`fx-${t}`, { duration: 10 })
    }
    // A fresh type is under its per-type cap but over the global budget
    dispatchEffect('fx-4', { duration: 10 })

    expect(handlers.get('fx-4')).not.toHaveBeenCalled()
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('global effect budget'))
  })
})
