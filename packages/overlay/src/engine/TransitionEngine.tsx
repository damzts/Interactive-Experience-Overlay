import { useEffect, useRef } from 'react'
import { useAppStore } from '../store/useAppStore'
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

type TransitionFn = (onComplete: () => void) => gsap.core.Timeline

/**
 * All registered GSAP transitions. Keys are self-documenting names describing
 * the visual effect — not the states they were originally designed for.
 * Any key can be assigned to any scene's introTransition / exitTransition.
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

/** Invisible component — watches pendingTransition and runs GSAP timelines */
export function TransitionEngine() {
  const pendingTransition = useAppStore((s) => s.pendingTransition)
  const activeTimeline = useRef<gsap.core.Timeline | null>(null)

  useEffect(() => {
    if (!pendingTransition) return

    // Kill any currently running timeline
    activeTimeline.current?.kill()

    const complete = () => {}

    const exitFn  = pendingTransition.exitTransition  ? TRANSITION_MAP[pendingTransition.exitTransition]  : undefined
    const introFn = pendingTransition.introTransition ? TRANSITION_MAP[pendingTransition.introTransition] : undefined
    const singleFn = TRANSITION_MAP[pendingTransition.transitionType]

    if (exitFn && introFn) {
      // Chain: exit plays fully, then intro plays, then complete
      activeTimeline.current = exitFn(() => {
        activeTimeline.current = introFn(complete)
      })
    } else if (exitFn) {
      activeTimeline.current = exitFn(complete)
    } else if (introFn) {
      activeTimeline.current = introFn(complete)
    } else if (singleFn) {
      activeTimeline.current = singleFn(complete)
    } else {
      complete()
    }
  }, [pendingTransition])

  return null
}
