import type { KernelSignalMap, SequenceEffectConfig, SequenceStep } from '@ieomlabs/shared'
import { getEffectHandler, estimateDurationMs } from './registry'
import { addWidgetSignalListener, dispatchWidgetSignal } from '../desktop/widgetSimulationEvents'
import { onKernelSignal } from '../socket/kernelSignals'

// ── Renderer-mount steps ─────────────────────────────────────────
// runSequence is a plain function, not a React component, but a `renderer`
// step needs to mount an actual React renderer. A tiny pub-sub bus lets it
// hand mount/unmount commands to <SequenceRendererHost />, which is mounted
// once (in TransitionEngine's output) and renders whatever is currently active.

export interface ActiveSequenceRenderer {
  id: string
  renderer: string
  config: Record<string, unknown>
}

type RendererBusListener = (active: ActiveSequenceRenderer[]) => void

class SequenceRendererBus {
  private active: ActiveSequenceRenderer[] = []
  private listeners = new Set<RendererBusListener>()

  subscribe(listener: RendererBusListener): () => void {
    this.listeners.add(listener)
    listener(this.active)
    return () => { this.listeners.delete(listener) }
  }

  private notify() {
    for (const l of this.listeners) l(this.active)
  }

  mount(entry: ActiveSequenceRenderer) {
    this.active = [...this.active, entry]
    this.notify()
  }

  unmount(id: string) {
    this.active = this.active.filter((r) => r.id !== id)
    this.notify()
  }
}

export const sequenceRendererBus = new SequenceRendererBus()

function stepWaitMs(step: SequenceStep): number {
  if (step.waitMs != null) return step.waitMs
  if (step.effect) return estimateDurationMs(step.effect.cfg)
  if (step.emitSignal) return 0
  return 2000
}

const DEFAULT_SIGNAL_TIMEOUT_MS = 30_000

/** Wait for a named signal on either bus — the kernel:signal channel
 *  (public domain events like 'twitch:follow') or the widget DOM bus
 *  ('quest:complete') — whichever arrives first, or the timeout. */
function waitForSignal(event: string, timeoutMs: number, done: () => void): () => void {
  let finished = false
  let timer: ReturnType<typeof setTimeout> | null = null
  const cleanups: Array<() => void> = []
  const finish = () => {
    if (finished) return
    finished = true
    if (timer != null) clearTimeout(timer)
    for (const off of cleanups) off()
    done()
  }
  cleanups.push(onKernelSignal(event as keyof KernelSignalMap, () => finish()))
  cleanups.push(addWidgetSignalListener((detail) => { if (detail.event === event) finish() }))
  timer = setTimeout(finish, timeoutMs)
  return () => {
    finished = true
    if (timer != null) clearTimeout(timer)
    for (const off of cleanups) off()
  }
}

/** Runs an ordered list of steps; returns a canceller. Recursion powers
 *  `parallel` groups — each sub-step runs as its own single-step list. */
function runSteps(steps: SequenceStep[], onComplete?: () => void): () => void {
  let cancelled = false
  // Whatever the currently active step needs torn down on cancel.
  let activeCleanup: (() => void) | null = null

  const cancel = () => {
    cancelled = true
    activeCleanup?.()
    activeCleanup = null
  }

  const runStep = (idx: number): void => {
    if (cancelled) return
    activeCleanup = null
    if (idx >= steps.length) { onComplete?.(); return }
    const step = steps[idx]
    const next = () => runStep(idx + 1)

    if (step.parallel && step.parallel.length > 0) {
      const subs = step.parallel
      const fixedDuration = step.waitMs != null
      let advanced = false
      let groupTimer: ReturnType<typeof setTimeout> | null = null
      let subCancels: Array<() => void> = []
      const advance = () => {
        if (advanced || cancelled) return
        advanced = true
        if (groupTimer != null) clearTimeout(groupTimer)
        next()
      }
      let remaining = subs.length
      subCancels = subs.map((sub) => runSteps([sub], () => {
        remaining -= 1
        if (remaining === 0 && !fixedDuration) advance()
      }))
      if (fixedDuration) {
        // waitMs on the group = fixed duration override; cancels stragglers.
        groupTimer = setTimeout(() => {
          for (const c of subCancels) c()
          advance()
        }, step.waitMs)
      }
      // Sub-steps may all have completed synchronously — advance() already
      // ran and the NEXT step's cleanup is active; don't clobber it.
      if (!advanced) {
        activeCleanup = () => {
          if (groupTimer != null) clearTimeout(groupTimer)
          for (const c of subCancels) c()
        }
      }
      return
    }

    if (step.waitForSignal?.event) {
      activeCleanup = waitForSignal(
        step.waitForSignal.event,
        step.waitForSignal.timeoutMs ?? DEFAULT_SIGNAL_TIMEOUT_MS,
        next,
      )
      return
    }

    if (step.emitSignal?.event) {
      dispatchWidgetSignal({
        source: 'sequence',
        event: step.emitSignal.event,
        payload: step.emitSignal.payload ?? {},
      })
      const timer = setTimeout(next, stepWaitMs(step))
      activeCleanup = () => clearTimeout(timer)
      return
    }

    if (step.renderer) {
      const id = `__seq_${Date.now()}_${idx}_${Math.random().toString(16).slice(2, 6)}`
      sequenceRendererBus.mount({ id, renderer: step.renderer, config: step.rendererConfig ?? {} })
      const timer = setTimeout(() => {
        sequenceRendererBus.unmount(id)
        next()
      }, stepWaitMs(step))
      activeCleanup = () => {
        clearTimeout(timer)
        sequenceRendererBus.unmount(id)
      }
      return
    }

    if (step.effect) {
      const handler = getEffectHandler(step.effect.type)
      handler?.(step.effect.cfg)
      const timer = setTimeout(next, stepWaitMs(step))
      activeCleanup = () => clearTimeout(timer)
      return
    }

    // No-op step — advance immediately.
    next()
  }

  if (steps.length === 0) {
    onComplete?.()
  } else {
    runStep(0)
  }

  return cancel
}

/** Runs an ordered sequence of steps: an effect (any registered effect
 *  type — image/video overlay, a ported screen transition, or any of the
 *  ~90 ordinary effects), an ephemeral renderer mount, a signal wait/emit,
 *  or a parallel group. Generic — knows nothing about scenes; any caller
 *  can dispatch `dispatchEffect('sequence', { steps })`. Registered
 *  exclusive: the returned canceller tears down everything a run may have
 *  started. */
export function runSequence(cfg: SequenceEffectConfig): () => void {
  return runSteps(cfg.steps ?? [], cfg.onComplete)
}
