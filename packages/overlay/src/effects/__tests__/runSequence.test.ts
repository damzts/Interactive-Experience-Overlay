import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** registry.ts keeps module-level state, so give each test a fresh copy of
 *  both it and runSequence.ts (which imports from it). */
async function loadSequence() {
  vi.resetModules()
  const registry = await import('../registry')
  const sequence = await import('../runSequence')
  return { ...registry, ...sequence }
}

describe('runSequence', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('fires each effect step in order and advances after waitMs', async () => {
    const { registerEffect, runSequence } = await loadSequence()
    const calls: string[] = []
    registerEffect('a', () => { calls.push('a') })
    registerEffect('b', () => { calls.push('b') })

    const onComplete = vi.fn()
    runSequence({
      steps: [
        { effect: { type: 'a' as any, cfg: {} }, waitMs: 100 },
        { effect: { type: 'b' as any, cfg: {} }, waitMs: 50 },
      ],
      onComplete,
    })

    expect(calls).toEqual(['a'])
    vi.advanceTimersByTime(100)
    expect(calls).toEqual(['a', 'b'])
    expect(onComplete).not.toHaveBeenCalled()
    vi.advanceTimersByTime(50)
    expect(onComplete).toHaveBeenCalledOnce()
  })

  it('an effect step bypasses the concurrency budget (always fires)', async () => {
    const { registerEffect, dispatchEffect, runSequence } = await loadSequence()
    const handler = vi.fn()
    registerEffect('busy', handler)
    for (let i = 0; i < 5; i++) dispatchEffect('busy', { duration: 10 })
    expect(handler).toHaveBeenCalledTimes(3) // budget-capped

    runSequence({ steps: [{ effect: { type: 'busy' as any, cfg: {} }, waitMs: 10 }] })
    expect(handler).toHaveBeenCalledTimes(4) // sequence step still fired
  })

  it('mounts and unmounts a renderer step on schedule', async () => {
    const { runSequence, sequenceRendererBus } = await loadSequence()
    const seen: unknown[] = []
    sequenceRendererBus.subscribe((active) => seen.push(active))

    runSequence({ steps: [{ renderer: 'my-renderer', waitMs: 200 }] })
    expect(seen.at(-1)).toEqual([{ id: expect.any(String), renderer: 'my-renderer', config: {} }])

    vi.advanceTimersByTime(200)
    expect(seen.at(-1)).toEqual([])
  })

  it('cancelling mid-sequence stops it from advancing', async () => {
    const { registerEffect, runSequence } = await loadSequence()
    const calls: string[] = []
    registerEffect('a', () => { calls.push('a') })
    registerEffect('b', () => { calls.push('b') })

    const cancel = runSequence({
      steps: [
        { effect: { type: 'a' as any, cfg: {} }, waitMs: 100 },
        { effect: { type: 'b' as any, cfg: {} }, waitMs: 50 },
      ],
    })

    expect(calls).toEqual(['a'])
    cancel()
    vi.advanceTimersByTime(200)
    expect(calls).toEqual(['a']) // 'b' never fires
  })

  it('calls onComplete immediately for an empty sequence', async () => {
    const { runSequence } = await loadSequence()
    const onComplete = vi.fn()
    runSequence({ steps: [], onComplete })
    expect(onComplete).toHaveBeenCalledOnce()
  })
})
