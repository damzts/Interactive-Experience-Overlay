import { useEffect, useRef } from 'react'
import { STATE, OVERLAY_EVENT } from '@ieom/shared'
import type { AppConfig } from '@ieom/shared'
import { socket } from './client'
import { useAppStore, type PendingTransition } from '../store/useAppStore'
import { runDeathOverlay } from '../transitions/DeathOverlay'
import { runVictoryOverlay } from '../transitions/VictoryOverlay'
import { runReviveOverlay } from '../transitions/ReviveOverlay'
import { runNetworkGlitch } from '../transitions/NetworkGlitch'
import { audioEngine } from '../engine/AudioEngine'

/** Connects socket events to the app store. Mount once — inside App. */
export function useSocket() {
  const setVisualState = useAppStore((s) => s.setVisualState)
  const setPendingTransition = useAppStore((s) => s.setPendingTransition)
  const clearPendingTransition = useAppStore((s) => s.clearPendingTransition)
  const setConfig = useAppStore((s) => s.setConfig)
  const setObsConnected = useAppStore((s) => s.setObsConnected)
  const audioUnlocked = useRef(false)

  useEffect(() => {
    // Request current state on connect
    socket.emit('state:request', (serverState: STATE) => {
      if (serverState !== STATE.TRANSITIONING) {
        setVisualState(serverState as Exclude<STATE, typeof STATE.TRANSITIONING>)
      }
    })

    const onStateUpdate = (payload: { state: STATE; previousState: STATE }) => {
      // Unlock AudioContext on first server event (OBS Browser Source needs no gesture)
      if (!audioUnlocked.current) {
        audioUnlocked.current = true
        audioEngine.unlockContext()
      }
      if (payload.state !== STATE.TRANSITIONING) {
        setVisualState(payload.state as Exclude<STATE, typeof STATE.TRANSITIONING>)
        clearPendingTransition()
      }
    }

    const onTransitionPlay = (payload: {
      from: STATE
      to: STATE
      transitionType: string
    }) => {
      setPendingTransition(payload as PendingTransition)
    }

    const onOverlayShow = (payload: { event: OVERLAY_EVENT }) => {
      if (payload.event === OVERLAY_EVENT.DEATH)          runDeathOverlay()
      if (payload.event === OVERLAY_EVENT.VICTORY)        runVictoryOverlay()
      if (payload.event === OVERLAY_EVENT.REVIVE)         runReviveOverlay()
      if (payload.event === OVERLAY_EVENT.NETWORK_GLITCH) runNetworkGlitch()
    }

    const onConfigUpdate = (config: AppConfig) => {
      setConfig(config)
    }

    const onObsStatus = (payload: { connected: boolean }) => {
      setObsConnected(payload.connected)
    }

    socket.on('state:update', onStateUpdate)
    socket.on('transition:play', onTransitionPlay)
    socket.on('overlay:show', onOverlayShow)
    socket.on('config:update', onConfigUpdate)
    socket.on('obs:status', onObsStatus)

    return () => {
      socket.off('state:update', onStateUpdate)
      socket.off('transition:play', onTransitionPlay)
      socket.off('overlay:show', onOverlayShow)
      socket.off('config:update', onConfigUpdate)
      socket.off('obs:status', onObsStatus)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
