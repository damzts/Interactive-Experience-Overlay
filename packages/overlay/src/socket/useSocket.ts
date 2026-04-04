import { useEffect, useRef } from 'react'
import {
  DEFAULT_DESKTOP_NOTIFICATION_DURATION_MS,
  STATE,
  withDesktopConfigDefaults,
  type DesktopNotificationPayload,
  type DesktopRecycleBinPayload,
  type CursorMirrorPayload,
  type OpenWidgetMenuTimelinePayload,
  type EffectConfig,
  type TransitionPlayPayload,
} from '@ieom/shared'
import type { AppConfig } from '@ieom/shared'
import { socket } from './client'
import { useAppStore } from '../store/useAppStore'
import { dispatchEffect } from '../effects/registry'
import '../effects/index'
import { audioEngine } from '../engine/AudioEngine'
import { runWidgetCursorSimulation } from '../desktop/cursorSimUtils'

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
  const patchConfig = useAppStore((s) => s.patchConfig)
  const setObsConnected = useAppStore((s) => s.setObsConnected)
  const enqueueDesktopNotification = useAppStore((s) => s.enqueueDesktopNotification)
  const setRecycleBinFull = useAppStore((s) => s.setRecycleBinFull)
  const setReactiveIconId = useAppStore((s) => s.setReactiveIconId)
  const markSocketActivity = useAppStore((s) => s.markSocketActivity)
  const syncDesktopRuntimeState = useAppStore((s) => s.syncDesktopRuntimeState)
  const audioUnlocked = useRef(false)
  const reactiveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const menuTimelineLockUntil = useRef(0)

  useEffect(() => {
    const pulseReactiveIcon = (state: STATE) => {
      const store = useAppStore.getState()
      const desktopConfig = withDesktopConfigDefaults(store.config.desktopConfig)
      if (desktopConfig.iconAnimation !== 'reactive') return

      const sceneApp = store.config.applications.find((app) => (
        app.appType === 'scene' && app.targetSceneId === state
      ))

      if (!sceneApp) return

      setReactiveIconId(sceneApp.id)
      if (reactiveTimer.current) clearTimeout(reactiveTimer.current)
      reactiveTimer.current = setTimeout(() => setReactiveIconId(null), 720)
    }

    // Called on initial connect AND every reconnect — keeps state in sync after drops
    const onConnect = () => {
      socket.emit('state:request', (serverState: STATE) => {
        setVisualState(serverState as Exclude<STATE, typeof STATE.TRANSITIONING>)
        pulseReactiveIcon(serverState)
      })
      socket.emit('desktop:state:request', (payload) => {
        syncDesktopRuntimeState(payload)
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

    const onConfigUpdate = (config: AppConfig) => {
      setConfig(config)
    }

    const onConfigPatch = (updates: Partial<AppConfig>) => {
      patchConfig(updates)
    }

    const onObsStatus = (payload: { connected: boolean }) => {
      setObsConnected(payload.connected)
    }

    const onWidgetToggle = (widgetId: string) => {
      useAppStore.getState().toggleWidget(widgetId)
    }

    const onDesktopNotify = (payload: DesktopNotificationPayload) => {
      enqueueDesktopNotification({
        ...payload,
        durationMs: payload.durationMs ?? DEFAULT_DESKTOP_NOTIFICATION_DURATION_MS,
      })
    }

    const onDesktopRecycleBin = (payload: DesktopRecycleBinPayload) => {
      setRecycleBinFull(payload.full)
    }

    const onCursorMirror = (payload: CursorMirrorPayload) => {
      const cursor = (window as any).__cursorOverlayController
      if (!cursor) return
      const now = Date.now()
      const locked = now < menuTimelineLockUntil.current
      if (locked && (payload.kind === 'move' || payload.kind === 'click')) {
        return
      }

      if (payload.kind === 'move') {
        ;(window as any).__cursorMirrorApplying = true
        void cursor.moveTo(payload.x, payload.y, { duration: payload.duration ?? 600 }).finally(() => {
          ;(window as any).__cursorMirrorApplying = false
        })
        return
      }

      if (payload.kind === 'click') {
        ;(window as any).__cursorMirrorApplying = true
        void cursor.click().finally(() => {
          ;(window as any).__cursorMirrorApplying = false
        })
        return
      }

      ;(window as any).__cursorMirrorApplying = true
      cursor.setVisible(payload.visible)
      ;(window as any).__cursorMirrorApplying = false
    }

    const onMirrorMenuTimeline = (payload: OpenWidgetMenuTimelinePayload) => {
      const cursor = (window as any).__cursorOverlayController
      if (!cursor) return
      const totalMs = payload.startMoveMs
        + payload.startPostMs
        + payload.steps.reduce((sum, step) => sum + step.moveMs + step.hoverMs + step.postMs, 0)
      menuTimelineLockUntil.current = Date.now() + totalMs + 400
      void runWidgetCursorSimulation(cursor, payload.widgetLabel, {
        startMenu: false,
        menuPath: payload.menuPath,
        visualOnly: true,
        driveCursorVisualOnly: true,
        allowDomActionsInVisualOnly: false,
        debugTag: `mirror:${payload.targetAppId ?? payload.widgetLabel}`,
        targetAppId: payload.targetAppId,
        activateLeafClick: false,
        openFirstLevelOnHover: true,
        closeStartMenuAfterPath: false,
        timingPlan: {
          startMoveMs: payload.startMoveMs,
          startPostMs: payload.startPostMs,
          steps: payload.steps,
        },
      })
    }

    const onAny = () => {
      markSocketActivity()
    }

    socket.on('state:update', onStateUpdate)
    socket.on('transition:play', onTransitionPlay)
    socket.on('overlay:show', onOverlayShow)
    socket.on('config:update', onConfigUpdate)
    socket.on('config:patch', onConfigPatch)
    socket.on('obs:status', onObsStatus)
    socket.on('widget:toggle', onWidgetToggle)
    socket.on('desktop:notify', onDesktopNotify)
    socket.on('desktop:recycle-bin', onDesktopRecycleBin)
    socket.on('cursor:mirror', onCursorMirror)
    socket.on('cursor:mirror:menu-timeline', onMirrorMenuTimeline)
    socket.onAny(onAny)

    return () => {
      if (reactiveTimer.current) clearTimeout(reactiveTimer.current)
      socket.off('connect', onConnect)
      socket.off('state:update', onStateUpdate)
      socket.off('transition:play', onTransitionPlay)
      socket.off('overlay:show', onOverlayShow)
      socket.off('config:update', onConfigUpdate)
      socket.off('config:patch', onConfigPatch)
      socket.off('obs:status', onObsStatus)
      socket.off('widget:toggle', onWidgetToggle)
      socket.off('desktop:notify', onDesktopNotify)
      socket.off('desktop:recycle-bin', onDesktopRecycleBin)
      socket.off('cursor:mirror', onCursorMirror)
      socket.off('cursor:mirror:menu-timeline', onMirrorMenuTimeline)
      socket.offAny(onAny)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
