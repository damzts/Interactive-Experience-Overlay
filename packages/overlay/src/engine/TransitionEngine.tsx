import { useEffect, useRef } from 'react'
import { useAppStore } from '../store/useAppStore'
import { socket } from '../socket/client'
import type gsap from 'gsap'
import { lobbyToDesktop } from '../transitions/LobbyToDesktop'
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

    const fn = TRANSITION_MAP[pendingTransition.transitionType]

    if (!fn) {
      // No GSAP animation defined for this pair → complete immediately
      socket.emit('transition:complete')
      return
    }

    const tl = fn(() => {
      socket.emit('transition:complete')
    })

    activeTimeline.current = tl
  }, [pendingTransition])

  return null
}
