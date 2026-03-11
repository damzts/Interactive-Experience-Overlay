import { useEffect, useRef } from 'react'
import { useAppStore } from '../store/useAppStore'
import type { TransitionStep } from '@ieom/shared'
import type gsap from 'gsap'
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

/**
 * All registered GSAP transitions. Keys are self-documenting names describing
 * the visual effect — not the states they were originally designed for.
 * Any key can be assigned to any scene's introTransitions / exitTransitions.
 */
const TRANSITION_MAP: Record<string, TransitionFn> = {
  // ── Scene transitions ──────────────────────────────────────────────
  'zoom-in':       lobbyToDesktop,   // camera rushes into CRT screen
  'zoom-out':      desktopToLobby,   // screen shrinks back to 3D room
  'win98-loading': lobbyToGameplay,  // Win98 progress dialog + bar
  'crt-wipe':      gameplayToLobby,  // CRT static fills screen then clears
  'channel-sweep': lobbyToTV,        // TV channel-change scan-line sweep
  'boot-sequence': playBootSequence, // BIOS POST text + progress bar
  // ── Universal transitions ──────────────────────────────────────────
  'fade':          fadeTransition,
  'glitch-burst':  glitchBurst,
  'static-burst':  staticBurst,
  'wipe-left':     wipeLeft,
  'wipe-right':    wipeRight,
}

/**
 * Run a `media:type:url[||dur=N]` step.
 *
 * Duration parsing: server strings use `||dur=N`, step.duration overrides.
 * Returns the effective duration in seconds.
 */
function runMediaStep(step: TransitionStep): number {
  const rest     = step.id.slice(6)         // strip leading 'media:'
  const sepIdx   = rest.indexOf(':')
  const mtype    = rest.slice(0, sepIdx)
  const after    = rest.slice(sepIdx + 1)
  const parts    = after.split('||')
  const url      = parts[0] ?? ''
  const durPart  = parts.slice(1).find(p => p.startsWith('dur='))
  const segDur   = durPart ? parseFloat(durPart.slice(4)) : undefined
  const duration = step.duration ?? segDur ?? 4

  if (mtype === 'video') {
    runVideoOverlay({ src: url, duration, opacity: 1 })
  } else {
    runImageOverlay({ src: url, duration, opacity: 1 })
  }
  return duration
}

/** Invisible component — watches pendingTransition and runs GSAP pipelines */
export function TransitionEngine() {
  const pendingTransition  = useAppStore((s) => s.pendingTransition)
  const activeTimeline     = useRef<gsap.core.Timeline | null>(null)
  /** Used to cancel a pending setTimeout when the transition is killed */
  const mediaTimer         = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!pendingTransition) return

    activeTimeline.current?.kill()
    if (mediaTimer.current != null) { clearTimeout(mediaTimer.current); mediaTimer.current = null }

    /** Flush the buffered visual state (scene content swap). */
    const applyState = () => {
      const store = useAppStore.getState()
      if (store.pendingVisualState != null) {
        store.setVisualState(store.pendingVisualState)
        store.clearPendingVisualState()
      }
    }

    /** Finish the whole transition sequence. */
    const complete = () => {
      applyState()
      useAppStore.getState().clearPendingTransition()
    }

    /**
     * Sequential pipeline runner.
     * Plays each TransitionStep in order; calls `onComplete` after the last step.
     *
     * Supports:
     *  - GSAP keys (looked up in TRANSITION_MAP)
     *  - `media:video:<url>` / `media:image:<url>` overlay players
     *  - `step.duration` overrides the timeline duration for GSAP steps
     */
    const runPipeline = (steps: TransitionStep[], onComplete: () => void, idx = 0): void => {
      if (idx >= steps.length) { onComplete(); return }

      const step = steps[idx]
      const next = () => runPipeline(steps, onComplete, idx + 1)

      if (step.id.startsWith('media:')) {
        // Media overlay: fire + forget, advance after duration
        const dur = runMediaStep(step)
        mediaTimer.current = setTimeout(next, dur * 1000)
        return
      }

      const fn = TRANSITION_MAP[step.id]
      if (!fn) {
        // Unknown key — skip silently
        next()
        return
      }

      const tl = fn(next)
      if (step.duration && step.duration > 0) tl.duration(step.duration)
      activeTimeline.current = tl
    }

    const { exit, intro } = pendingTransition

    if (exit.length > 0 || intro.length > 0) {
      // Standard pipeline:
      //  1. Play all exit steps in sequence
      //  2. Swap scene content (applyState)
      //  3. Play all intro steps in sequence
      //  4. Complete
      runPipeline(exit, () => {
        applyState()
        runPipeline(intro, complete)
      })
    } else {
      // No transitions defined — instant cut
      complete()
    }
  }, [pendingTransition])

  return null
}

