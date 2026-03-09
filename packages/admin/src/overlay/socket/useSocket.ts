import { useEffect, useRef } from 'react'
import { STATE, type OverlayTriggerPayload, type EffectConfig } from '@ieom/shared'
import type { AppConfig } from '@ieom/shared'
import { socket } from './client'
import { useAppStore, type PendingTransition } from '../store/useAppStore'
import { runDeathOverlay } from '../transitions/DeathOverlay'
import { runVictoryOverlay } from '../transitions/VictoryOverlay'
import { runReviveOverlay } from '../transitions/ReviveOverlay'
import { runNetworkGlitch } from '../transitions/NetworkGlitch'
import { runNotificationBox } from '../transitions/NotificationBox'
import { runIdleOverlay } from '../transitions/IdleOverlay'
import { runSysMessage } from '../transitions/SysMessage'
import { runArchiveCorruption } from '../transitions/ArchiveCorruption'
import { runVignettePulse } from '../transitions/VignettePulse'
import { runScreenShake } from '../transitions/ScreenShake'
import { runTypewriter } from '../transitions/Typewriter'
import { runStaticBurst } from '../transitions/StaticBurstConfigured'
import { runImageOverlay } from '../transitions/ImageOverlay'
import { runVideoOverlay } from '../transitions/VideoOverlay'
import { audioEngine } from '../engine/AudioEngine'

function dispatchEffect(effect: EffectConfig): void {
  switch (effect.type) {
    case 'notification-box':  runNotificationBox(effect.cfg);  break
    case 'terminal-toast':    runSysMessage(effect.cfg);       break
    case 'floaties':          runIdleOverlay(effect.cfg);      break
    case 'corruption-burst':  runArchiveCorruption(effect.cfg); break
    case 'network-glitch':    runNetworkGlitch(effect.cfg);    break
    case 'vignette-pulse':    runVignettePulse(effect.cfg);    break
    case 'screen-shake':      runScreenShake(effect.cfg);      break
    case 'typewriter':        runTypewriter(effect.cfg);       break
    case 'static-burst':      runStaticBurst(effect.cfg);      break
    case 'death-overlay':     runDeathOverlay();               break
    case 'victory-overlay':   runVictoryOverlay();             break
    case 'revive-overlay':    runReviveOverlay();              break
    case 'image-overlay':     runImageOverlay(effect.cfg);     break
    case 'video-overlay':     runVideoOverlay(effect.cfg);     break
  }
}

const SFX_MAP: Partial<Record<EffectConfig['type'], Parameters<typeof audioEngine.play>[0]>> = {
  'death-overlay':   'death',
  'victory-overlay': 'victory',
  'revive-overlay':  'revive',
  'network-glitch':  'glitch',
  'corruption-burst': 'glitch',
  'static-burst':    'transition',
}

/** Connects socket events to the app store. Mount once — inside App. */
export function useSocket() {
  const setVisualState = useAppStore((s) => s.setVisualState)
  const setPendingTransition = useAppStore((s) => s.setPendingTransition)
  const clearPendingTransition = useAppStore((s) => s.clearPendingTransition)
  const setConfig = useAppStore((s) => s.setConfig)
  const setObsConnected = useAppStore((s) => s.setObsConnected)
  const audioUnlocked = useRef(false)

  useEffect(() => {
    // Request current state and latest config on connect
    socket.emit('state:request', (serverState: STATE) => {
      if (serverState === STATE.TRANSITIONING) {
        // Server is stuck mid-transition (we missed transition:play) — unstick it
        socket.emit('transition:complete')
      } else {
        setVisualState(serverState as Exclude<STATE, typeof STATE.TRANSITIONING>)
      }
    })
    fetch('/api/config').then((r) => r.json()).then(setConfig).catch(() => {})

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
      audioEngine.play('transition')
      setPendingTransition(payload as PendingTransition)
    }

    const onOverlayShow = (payload: OverlayTriggerPayload) => {
      const { effects } = payload
      if (!effects.length) return
      effects.forEach((eff) => {
        const sfx = SFX_MAP[eff.type]
        const fire = () => {
          dispatchEffect(eff)
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
