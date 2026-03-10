import { useEffect, useRef } from 'react'
import { useAppStore } from '../store/useAppStore'
import type gsap from 'gsap'
import { lobbyToDesktop } from '../transitions/LobbyToDesktop'
import { desktopToLobby } from '../transitions/DesktopToLobby'
import { lobbyToGameplay } from '../transitions/LobbyToGameplay'
import { gameplayToLobby } from '../transitions/GameplayToLobby'
import { lobbyToTV } from '../transitions/LobbyToTV'
import { tvToLobby } from '../transitions/TVToLobby'
import { fadeTransition } from '../transitions/Fade'
import { glitchBurst } from '../transitions/GlitchBurst'
import { staticBurst } from '../transitions/StaticBurst'
import { wipeLeft } from '../transitions/WipeLeft'
import { wipeRight } from '../transitions/WipeRight'

type TransitionFn = (onComplete: () => void) => gsap.core.Timeline

const TRANSITION_MAP: Record<string, TransitionFn> = {
  'lobby-to-desktop':    lobbyToDesktop,
  'desktop-to-lobby':    desktopToLobby,
  'desktop-to-gameplay': lobbyToGameplay,  // loading-dialog animation
  'gameplay-to-desktop': gameplayToLobby,  // CRT static wipe
  'desktop-to-tv':       lobbyToTV,        // channel-change sweep
  'tv-to-desktop':       tvToLobby,        // channel-change sweep
  'fade':                fadeTransition,
  'glitch-burst':        glitchBurst,
  'static-burst':        staticBurst,
  'wipe-left':           wipeLeft,
  'wipe-right':          wipeRight,
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
