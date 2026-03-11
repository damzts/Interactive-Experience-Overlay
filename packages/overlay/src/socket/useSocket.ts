import { useEffect, useRef } from 'react'
import { STATE, type EffectConfig, type TransitionPlayPayload } from '@ieom/shared'
import type { AppConfig } from '@ieom/shared'
import { socket } from './client'
import { useAppStore } from '../store/useAppStore'
import { dispatchEffect } from '../effects/registry'
import '../effects/index'
import { audioEngine } from '../engine/AudioEngine'

const SFX_MAP: Partial<Record<EffectConfig['type'], Parameters<typeof audioEngine.play>[0]>> = {
  'death-overlay':    'death',
  'victory-overlay':  'victory',
  'revive-overlay':   'revive',
  'network-glitch':   'glitch',
  'corruption-burst': 'glitch',
  'static-burst':     'transition',
}

/** Connects socket events to the app store. Mount once — inside App. */
export function useSocket() {
  const setVisualState = useAppStore((s) => s.setVisualState)
  const setPendingVisualState = useAppStore((s) => s.setPendingVisualState)
  const setPendingTransition = useAppStore((s) => s.setPendingTransition)
  const setConfig = useAppStore((s) => s.setConfig)
  const setObsConnected = useAppStore((s) => s.setObsConnected)
  const audioUnlocked = useRef(false)

  useEffect(() => {
    // Called on initial connect AND every reconnect — keeps state in sync after drops
    const onConnect = () => {
      socket.emit('state:request', (serverState: STATE) => {
        setVisualState(serverState as Exclude<STATE, typeof STATE.TRANSITIONING>)
      })
      fetch('/api/config').then((r) => r.json()).then(setConfig).catch(() => {})
    }

    // Fire immediately if already connected (page load), else wait for connect event
    if (socket.connected) {
      onConnect()
    }

    socket.on('connect', onConnect)

    const onStateUpdate = (payload: { state: string; previousState: string }) => {
      // Unlock AudioContext on first server event (OBS Browser Source needs no gesture)
      if (!audioUnlocked.current) {
        audioUnlocked.current = true
        audioEngine.unlockContext()
      }
      // Buffer the new state — TransitionEngine will apply it at the transition midpoint.
      // If no transition is running (e.g. initial connect), applyState falls back to setVisualState.
      const next = payload.state as Parameters<typeof setVisualState>[0]
      if (useAppStore.getState().pendingTransition) {
        setPendingVisualState(next)
      } else {
        setVisualState(next)
      }
    }

    const onTransitionPlay = (payload: TransitionPlayPayload) => {
      audioEngine.play('transition')
      setPendingTransition(payload)
    }

    const onOverlayShow = (payload: { effects: EffectConfig[] }) => {
      const { effects } = payload
      if (!effects.length) return
      effects.forEach((eff) => {
        const sfx = SFX_MAP[eff.type]
        const fire = () => {
          dispatchEffect(eff.type, eff.cfg)
          if (sfx) audioEngine.play(sfx)
        }
        const delay = eff.delay ?? 0
        if (delay > 0) setTimeout(fire, delay * 1000)
        else fire()
      })
    }

    const onConfigUpdate = (config: AppConfig) => {
      setConfig(config)
    }

    const onObsStatus = (payload: { connected: boolean }) => {
      setObsConnected(payload.connected)
    }

    const onWidgetToggle = (widgetId: string) => {
      useAppStore.getState().toggleWidget(widgetId)
    }

    socket.on('state:update', onStateUpdate)
    socket.on('transition:play', onTransitionPlay)
    socket.on('overlay:show', onOverlayShow)
    socket.on('config:update', onConfigUpdate)
    socket.on('obs:status', onObsStatus)
    socket.on('widget:toggle', onWidgetToggle)

    return () => {
      socket.off('connect', onConnect)
      socket.off('state:update', onStateUpdate)
      socket.off('transition:play', onTransitionPlay)
      socket.off('overlay:show', onOverlayShow)
      socket.off('config:update', onConfigUpdate)
      socket.off('obs:status', onObsStatus)
      socket.off('widget:toggle', onWidgetToggle)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
