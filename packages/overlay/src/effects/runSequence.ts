import type { SequenceEffectConfig, SequenceStep } from '@ieomlabs/shared'
import { getEffectHandler, estimateDurationMs } from './registry'

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
  return 2000
}

/** Runs an ordered sequence of steps: an effect (any registered effect
 *  type — image/video overlay, a ported screen transition, or any of the
 *  ~90 ordinary effects), or an ephemeral renderer mount. Generic — knows
 *  nothing about scenes; any caller can dispatch
 *  `dispatchEffect('sequence', { steps })`. Registered exclusive: the
 *  returned canceller tears down everything a run may have started. */
export function runSequence(cfg: SequenceEffectConfig): () => void {
  const steps = cfg.steps ?? []
  let timer: ReturnType<typeof setTimeout> | null = null
  let mountedRendererId: string | null = null
  let cancelled = false

  const clearTimer = () => {
    if (timer != null) { clearTimeout(timer); timer = null }
  }

  const clearMountedRenderer = () => {
    if (mountedRendererId != null) {
      sequenceRendererBus.unmount(mountedRendererId)
      mountedRendererId = null
    }
  }

  const cancel = () => {
    cancelled = true
    clearTimer()
    clearMountedRenderer()
  }

  const runStep = (idx: number): void => {
    if (cancelled) return
    if (idx >= steps.length) { cfg.onComplete?.(); return }
    const step = steps[idx]
    const next = () => runStep(idx + 1)

    if (step.renderer) {
      const id = `__seq_${Date.now()}_${idx}`
      mountedRendererId = id
      sequenceRendererBus.mount({ id, renderer: step.renderer, config: step.rendererConfig ?? {} })
      timer = setTimeout(() => {
        sequenceRendererBus.unmount(id)
        if (mountedRendererId === id) mountedRendererId = null
        next()
      }, stepWaitMs(step))
      return
    }

    if (step.effect) {
      const handler = getEffectHandler(step.effect.type)
      handler?.(step.effect.cfg)
      timer = setTimeout(next, stepWaitMs(step))
      return
    }

    // No-op step (neither effect nor renderer set) — advance immediately.
    next()
  }

  if (steps.length === 0) {
    cfg.onComplete?.()
  } else {
    runStep(0)
  }

  return cancel
}
