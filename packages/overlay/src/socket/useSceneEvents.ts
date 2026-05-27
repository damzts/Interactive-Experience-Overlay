import { useEffect, useRef } from 'react'
import { STATE, withDesktopConfigDefaults } from '@ieom/shared'
import type { DesktopRuntimeStatePayload, EffectConfig, TransitionPlayPayload } from '@ieom/shared'
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

/** Handles scene state, transitions, effects, and overlay resync */
export function useSceneEvents() {
  const setVisualState = useAppStore((s) => s.setVisualState)
  const setPendingVisualState = useAppStore((s) => s.setPendingVisualState)
  const setPendingTransition = useAppStore((s) => s.setPendingTransition)
  const setReactiveIconId = useAppStore((s) => s.setReactiveIconId)
  const syncDesktopRuntimeState = useAppStore((s) => s.syncDesktopRuntimeState)
  const audioUnlocked = useRef(false)
  const reactiveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const pulseReactiveIcon = (state: STATE) => {
      const store = useAppStore.getState()
      const desktopConfig = withDesktopConfigDefaults(store.config.desktopConfig)
      if (desktopConfig.iconAnimation !== 'reactive') return
      const sceneApp = store.config.applications.find(
        (app) => app.appType === 'scene' && app.targetSceneId === state,
      )
      if (!sceneApp) return
      setReactiveIconId(sceneApp.id)
      if (reactiveTimer.current) clearTimeout(reactiveTimer.current)
      reactiveTimer.current = setTimeout(() => setReactiveIconId(null), 720)
    }

    const requestRuntimeSnapshot = () => {
      socket.emit('state:request', (serverState: STATE) => {
        setVisualState(serverState as Exclude<STATE, typeof STATE.TRANSITIONING>)
        pulseReactiveIcon(serverState)
      })
      socket.emit('desktop:state:request', (payload: DesktopRuntimeStatePayload) => {
        syncDesktopRuntimeState(payload)
      })
    }

    const onConnect = () => requestRuntimeSnapshot()
    if (socket.connected) onConnect()
    socket.on('connect', onConnect)

    const onStateUpdate = (payload: { state: string; previousState: string }) => {
      if (!audioUnlocked.current) {
        audioUnlocked.current = true
        audioEngine.unlockContext()
      }
      const next = payload.state as Parameters<typeof setVisualState>[0]
      if (useAppStore.getState().pendingTransition) {
        setPendingVisualState(next)
      } else {
        setVisualState(next)
      }
      pulseReactiveIcon(next as STATE)
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

    const onOverlayResync = () => requestRuntimeSnapshot()

    socket.on('state:update', onStateUpdate)
    socket.on('transition:play', onTransitionPlay)
    socket.on('overlay:show', onOverlayShow)
    socket.on('overlay:resync', onOverlayResync)

    return () => {
      if (reactiveTimer.current) clearTimeout(reactiveTimer.current)
      socket.off('connect', onConnect)
      socket.off('state:update', onStateUpdate)
      socket.off('transition:play', onTransitionPlay)
      socket.off('overlay:show', onOverlayShow)
      socket.off('overlay:resync', onOverlayResync)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
