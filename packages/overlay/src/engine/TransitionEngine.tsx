import { useEffect, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { dispatchEffect } from '../effects/registry'
import { sequenceRendererBus, type ActiveSequenceRenderer } from '../effects/runSequence'
import { resolveRenderer } from '../renderers/registry'
import type { SequenceEffectConfig } from '@ieomlabs/shared'

/** Watches pendingTransition (set from the kernel's SceneManager.transition()
 *  via the 'transition:play' signal) and translates it into 'sequence'
 *  effect dispatches: exit steps, apply the pending visual state, intro
 *  steps. This is glue only — the actual step pipeline lives in
 *  effects/runSequence.ts as a generic, independently-dispatchable effect
 *  handler; TransitionEngine just knows the scene-specific exit→apply→intro
 *  ordering. Also renders whatever renderer-based sequence step is
 *  currently active, from any 'sequence' dispatch (not just transitions). */
export function TransitionEngine() {
  const pendingTransition = useAppStore((s) => s.pendingTransition)

  useEffect(() => {
    if (!pendingTransition) return

    const applyState = () => {
      const store = useAppStore.getState()
      if (store.pendingVisualState != null) {
        store.setVisualState(store.pendingVisualState)
        store.clearPendingVisualState()
      }
    }

    const complete = () => { applyState(); useAppStore.getState().clearPendingTransition() }

    const { exit, intro } = pendingTransition
    if (exit.length === 0 && intro.length === 0) {
      complete()
      return
    }

    const runExit: SequenceEffectConfig = {
      steps: exit,
      onComplete: () => {
        applyState()
        const runIntro: SequenceEffectConfig = { steps: intro, onComplete: complete }
        dispatchEffect('sequence', runIntro)
      },
    }
    dispatchEffect('sequence', runExit)
  }, [pendingTransition])

  return <SequenceRendererHost />
}

/** Renders whichever renderer-based step the 'sequence' effect handler
 *  currently has mounted, at z:50 (above desktop, below the GSAP layer). */
function SequenceRendererHost() {
  const [active, setActive] = useState<ActiveSequenceRenderer[]>([])

  useEffect(() => sequenceRendererBus.subscribe(setActive), [])

  return (
    <>
      {active.map((r) => (
        <RendererSequenceMount key={r.id} renderer={r.renderer} config={r.config} />
      ))}
    </>
  )
}

function RendererSequenceMount({ renderer, config }: { renderer: string; config: Record<string, unknown> }) {
  const [Component, setComponent] = useState<React.ComponentType<import('../renderers/registry').RendererProps> | null>(null)

  useEffect(() => {
    resolveRenderer(renderer).then((def) => { if (def) setComponent(() => def.component) })
  }, [renderer])

  if (!Component) return null

  const NOOP = () => {}
  const NOOP_SIGNAL = () => () => {}
  const bounds = { x: 0, y: 0, width: 1920, height: 1080 }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, pointerEvents: 'none' }}>
      <Component config={config} bounds={bounds} emit={NOOP} onSignal={NOOP_SIGNAL} />
    </div>
  )
}
