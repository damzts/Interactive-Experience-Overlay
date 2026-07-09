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

/** The signal/emit step kinds ride the DOM bus (widgetSimulationEvents),
 *  which needs a window. Tests run in node — provide a minimal fake. */
function installFakeWindow() {
  const target = new EventTarget()
  ;(globalThis as any).window = {
    location: { port: '', protocol: 'http:' },
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    dispatchEvent: target.dispatchEvent.bind(target),
  }
  if (typeof (globalThis as any).CustomEvent === 'undefined') {
    ;(globalThis as any).CustomEvent = class extends Event {
      detail: unknown
      constructor(type: string, init?: { detail?: unknown }) {
        super(type)
        this.detail = init?.detail
      }
    }
  }
  return () => { delete (globalThis as any).window }
}

describe('runSequence signal and parallel steps', () => {
  let uninstall: () => void

  beforeEach(() => {
    uninstall = installFakeWindow()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    uninstall()
  })

  it('waitForSignal pauses until the widget signal arrives', async () => {
    const { registerEffect, runSequence } = await loadSequence()
    const { dispatchWidgetSignal } = await import('../../desktop/widgetSimulationEvents')
    const calls: string[] = []
    registerEffect('after', () => { calls.push('after') })

    runSequence({
      steps: [
        { waitForSignal: { event: 'hype:go', timeoutMs: 60_000 } },
        { effect: { type: 'after' as any, cfg: {} }, waitMs: 10 },
      ],
    })

    expect(calls).toEqual([])
    vi.advanceTimersByTime(1000)
    expect(calls).toEqual([]) // still waiting — timeout not reached
    dispatchWidgetSignal({ source: 'test', event: 'hype:go', payload: {} })
    expect(calls).toEqual(['after'])
  })

  it('waitForSignal advances after timeoutMs when the signal never arrives', async () => {
    const { registerEffect, runSequence } = await loadSequence()
    const calls: string[] = []
    registerEffect('after', () => { calls.push('after') })

    runSequence({
      steps: [
        { waitForSignal: { event: 'never:fires', timeoutMs: 500 } },
        { effect: { type: 'after' as any, cfg: {} }, waitMs: 10 },
      ],
    })

    vi.advanceTimersByTime(499)
    expect(calls).toEqual([])
    vi.advanceTimersByTime(1)
    expect(calls).toEqual(['after'])
  })

  it('emitSignal dispatches on the DOM bus and advances', async () => {
    const { runSequence } = await loadSequence()
    const { addWidgetSignalListener } = await import('../../desktop/widgetSimulationEvents')
    const seen: string[] = []
    addWidgetSignalListener((d) => seen.push(`${d.source}:${d.event}`))

    const onComplete = vi.fn()
    runSequence({
      steps: [{ emitSignal: { event: 'party:time', payload: { mood: 'hype' } } }],
      onComplete,
    })

    expect(seen).toEqual(['sequence:party:time'])
    vi.advanceTimersByTime(0)
    expect(onComplete).toHaveBeenCalledOnce()
  })

  it('parallel runs sub-steps concurrently and advances when all finish', async () => {
    const { registerEffect, runSequence } = await loadSequence()
    const calls: string[] = []
    registerEffect('x', () => { calls.push('x') })
    registerEffect('y', () => { calls.push('y') })
    registerEffect('after', () => { calls.push('after') })

    runSequence({
      steps: [
        {
          parallel: [
            { effect: { type: 'x' as any, cfg: {} }, waitMs: 100 },
            { effect: { type: 'y' as any, cfg: {} }, waitMs: 300 },
          ],
        },
        { effect: { type: 'after' as any, cfg: {} }, waitMs: 10 },
      ],
    })

    expect(calls).toEqual(['x', 'y']) // both fired immediately, together
    vi.advanceTimersByTime(100)
    expect(calls).toEqual(['x', 'y']) // y's wait still pending
    vi.advanceTimersByTime(200)
    expect(calls).toEqual(['x', 'y', 'after'])
  })

  it('parallel with waitMs is a fixed-duration group that cancels stragglers', async () => {
    const { registerEffect, runSequence } = await loadSequence()
    const calls: string[] = []
    registerEffect('x', () => { calls.push('x') })
    registerEffect('slow-follow', () => { calls.push('slow-follow') })
    registerEffect('after', () => { calls.push('after') })

    runSequence({
      steps: [
        {
          waitMs: 50,
          parallel: [
            // two-step sub-list would continue past the group cutoff — must be cancelled
            { effect: { type: 'x' as any, cfg: {} }, waitMs: 100 },
          ],
        },
        { effect: { type: 'after' as any, cfg: {} }, waitMs: 10 },
      ],
    })

    expect(calls).toEqual(['x'])
    vi.advanceTimersByTime(50)
    expect(calls).toEqual(['x', 'after']) // advanced at the group cutoff, not at 100ms
  })

  it('cancelling during a waitForSignal step detaches its listeners', async () => {
    const { registerEffect, runSequence } = await loadSequence()
    const { dispatchWidgetSignal } = await import('../../desktop/widgetSimulationEvents')
    const calls: string[] = []
    registerEffect('after', () => { calls.push('after') })

    const cancel = runSequence({
      steps: [
        { waitForSignal: { event: 'hype:go' } },
        { effect: { type: 'after' as any, cfg: {} }, waitMs: 10 },
      ],
    })

    cancel()
    dispatchWidgetSignal({ source: 'test', event: 'hype:go', payload: {} })
    vi.advanceTimersByTime(60_000)
    expect(calls).toEqual([])
  })
})
