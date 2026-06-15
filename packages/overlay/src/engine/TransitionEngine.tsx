import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import type { TransitionStep, BuiltInTransitionId } from '@ieomlabs/shared'
import type gsap from 'gsap'
import { resolveRenderer } from '../renderers/registry'
import { lobbyToDesktop }   from '../transitions/LobbyToDesktop'
import { desktopToLobby }   from '../transitions/DesktopToLobby'
import { lobbyToGameplay }  from '../transitions/LobbyToGameplay'
import { gameplayToLobby }  from '../transitions/GameplayToLobby'
import { lobbyToTV }        from '../transitions/LobbyToTV'
import { playBootSequence } from '../transitions/BootSequence'
import { fadeTransition }   from '../transitions/Fade'
import { glitchBurst }      from '../transitions/GlitchBurst'
import { staticBurst }      from '../transitions/StaticBurst'
import { wipeLeft }         from '../transitions/WipeLeft'
import { wipeRight }        from '../transitions/WipeRight'
import { runImageOverlay }  from '../transitions/ImageOverlay'
import { runVideoOverlay }  from '../transitions/VideoOverlay'

type TransitionFn = (onComplete: () => void) => gsap.core.Timeline

const TRANSITION_MAP: Record<BuiltInTransitionId, TransitionFn> = {
  'zoom-in':       lobbyToDesktop,
  'zoom-out':      desktopToLobby,
  'win98-loading': lobbyToGameplay,
  'crt-wipe':      gameplayToLobby,
  'channel-sweep': lobbyToTV,
  'boot-sequence': playBootSequence,
  'fade':          fadeTransition,
  'glitch-burst':  glitchBurst,
  'static-burst':  staticBurst,
  'wipe-left':     wipeLeft,
  'wipe-right':    wipeRight,
}

function runMediaStep(step: TransitionStep): number {
  const rest    = step.id.slice(6)
  const sepIdx  = rest.indexOf(':')
  const mtype   = rest.slice(0, sepIdx)
  const after   = rest.slice(sepIdx + 1)
  const parts   = after.split('||')
  const url     = parts[0] ?? ''
  const durPart = parts.slice(1).find(p => p.startsWith('dur='))
  const segDur  = durPart ? parseFloat(durPart.slice(4)) : undefined
  const duration = step.duration ?? segDur ?? 4
  if (mtype === 'video') runVideoOverlay({ src: url, duration, opacity: 1 })
  else runImageOverlay({ src: url, duration, opacity: 1 })
  return duration
}

interface ActiveRenderer {
  id: string
  renderer: string
  config: Record<string, unknown>
}

/** Watches pendingTransition and runs the GSAP + plugin pipeline. */
export function TransitionEngine() {
  const pendingTransition = useAppStore((s) => s.pendingTransition)
  const activeTimeline    = useRef<gsap.core.Timeline | null>(null)
  const timerRef          = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [activeRenderers, setActiveRenderers] = useState<ActiveRenderer[]>([])

  useEffect(() => {
    if (!pendingTransition) return

    activeTimeline.current?.kill()
    if (timerRef.current != null) { clearTimeout(timerRef.current); timerRef.current = null }

    const applyState = () => {
      const store = useAppStore.getState()
      if (store.pendingVisualState != null) {
        store.setVisualState(store.pendingVisualState)
        store.clearPendingVisualState()
      }
    }

    const complete = () => { applyState(); useAppStore.getState().clearPendingTransition() }

    const runPipeline = (steps: TransitionStep[], onComplete: () => void, idx = 0): void => {
      if (idx >= steps.length) { onComplete(); return }
      const step = steps[idx]
      const next = () => runPipeline(steps, onComplete, idx + 1)

      if (step.renderer) {
        const id = `__tp_${Date.now()}`
        const duration = step.duration ?? 2
        setActiveRenderers((prev) => [...prev, { id, renderer: step.renderer!, config: step.rendererConfig ?? {} }])
        timerRef.current = setTimeout(() => {
          setActiveRenderers((prev) => prev.filter((r) => r.id !== id))
          next()
        }, duration * 1000)
        return
      }

      if (step.id.startsWith('media:')) {
        timerRef.current = setTimeout(next, runMediaStep(step) * 1000)
        return
      }

      const fn = TRANSITION_MAP[step.id as BuiltInTransitionId]
      if (!fn) { next(); return }
      const tl = fn(next)
      if (step.duration && step.duration > 0) tl.duration(step.duration)
      activeTimeline.current = tl
    }

    const { exit, intro } = pendingTransition
    if (exit.length > 0 || intro.length > 0) {
      runPipeline(exit, () => { applyState(); runPipeline(intro, complete) })
    } else {
      complete()
    }
  }, [pendingTransition])

  // Render active renderer-based transition components at z:50 (above desktop, below GSAP layer)
  return (
    <>
      {activeRenderers.map((r) => (
        <RendererTransitionMount key={r.id} renderer={r.renderer} config={r.config} />
      ))}
    </>
  )
}

function RendererTransitionMount({ renderer, config }: { renderer: string; config: Record<string, unknown> }) {
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
