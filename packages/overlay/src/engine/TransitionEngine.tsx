import { useEffect, useRef } from 'react'
import { useAppStore } from '../store/useAppStore'
import { socket } from '../socket/client'
import gsap from 'gsap'
import { lobbyToGameplay } from '../transitions/LobbyToGameplay'
import { gameplayToLobby } from '../transitions/GameplayToLobby'
import { lobbyToTV } from '../transitions/LobbyToTV'
import { tvToLobby } from '../transitions/TVToLobby'

type TransitionFn = (onComplete: () => void) => gsap.core.Timeline

const TRANSITION_MAP: Record<string, TransitionFn> = {
  'lobby-to-gameplay': lobbyToGameplay,
  'gameplay-to-lobby': gameplayToLobby,
  'lobby-to-tv': lobbyToTV,
  'tv-to-lobby': tvToLobby,
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
