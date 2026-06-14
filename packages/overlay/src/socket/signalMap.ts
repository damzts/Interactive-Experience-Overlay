/**
 * Signal handler registry.
 *
 * Declarative map of every Kernel → Userspace signal and how the overlay
 * responds to it. useSignalReceiver iterates this map on mount and registers
 * all socket.on() handlers in one place.
 *
 * Adding a new signal = add one entry here. No hook hunting.
 */

import { withDesktopConfigDefaults, DEFAULT_DESKTOP_NOTIFICATION_DURATION_MS } from '@ieomlabs/shared'
import type {
  CursorMirrorPayload,
  DesktopNotificationPayload,
  DesktopRecycleBinPayload,
  DesktopStartMenuSimulationPhasePayload,
  DesktopStartMenuStatePayload,
  ObsStatusPayload,
  OpenWidgetMenuTimelinePayload,
  RuntimeConfig,
  TransitionPlayPayload,
  WidgetSimulationIntentPayload,
  ServerToClientEvents,
  AppConfig,
  EffectConfig,
  OverlayTriggerPayload,
} from '@ieomlabs/shared'
import { dispatchEffect } from '../effects/registry'
import '../effects/index'
import { audioEngine } from '../engine/AudioEngine'
import { dispatchWidgetSimulationIntent, dispatchWidgetChainAction } from '../desktop/widgetSimulationEvents'
import { runWidgetCursorSimulation } from '../desktop/cursorSimUtils'
import { socket } from './client'
import type { AppStore } from '../store/useAppStore'

// ── Types ────────────────────────────────────────────────────────

export type SignalHandler<T> = (payload: T, store: AppStore) => void

export type SignalHandlerMap = {
  [K in keyof ServerToClientEvents]?: SignalHandler<
    Parameters<ServerToClientEvents[K]>[0]
  >
}

// ── SFX map for effects ───────────────────────────────────────────

const SFX_MAP: Partial<Record<EffectConfig['type'], Parameters<typeof audioEngine.play>[0]>> = {
  'death-overlay':    'death',
  'victory-overlay':  'victory',
  'revive-overlay':   'revive',
  'network-glitch':   'glitch',
  'corruption-burst': 'glitch',
  'static-burst':     'transition',
}

// ── Cursor mirror helpers (need ref state, exposed via module-level vars) ─────

let menuTimelineLockUntil = 0

// ── Signal handler map ───────────────────────────────────────────

export const signalHandlers: SignalHandlerMap = {

  // ── Scene signals ──────────────────────────────────────────────

  'state:update': (payload, store) => {
    audioEngine.unlockContext()
    const next = payload.state as Parameters<typeof store.setVisualState>[0]
    if (store.pendingTransition) {
      store.setPendingVisualState(next)
    } else {
      store.setVisualState(next)
    }
    // Reactive icon pulse — no-op, scene apps no longer exist
  },

  'transition:play': (payload: TransitionPlayPayload, store) => {
    audioEngine.play('transition')
    store.setPendingTransition(payload)
  },

  'overlay:show': (payload: OverlayTriggerPayload, _store) => {
    const { effects } = payload
    if (!effects.length) return
    effects.forEach((eff) => {
      const fire = () => {
        dispatchEffect(eff.type, eff.cfg)
        if (eff.sfx) {
          // Custom sfx: URL path gets playUrl(), bare ID gets play()
          if (eff.sfx.includes('/')) {
            void audioEngine.playUrl(eff.sfx)
          } else {
            audioEngine.play(eff.sfx as Parameters<typeof audioEngine.play>[0])
          }
        } else {
          const sfxId = SFX_MAP[eff.type]
          if (sfxId) audioEngine.play(sfxId)
        }
      }
      const delay = eff.delay ?? 0
      if (delay > 0) setTimeout(fire, delay * 1000)
      else fire()
    })
  },

  'overlay:resync': (_payload, _store) => {
    // Signal the connect-sync hook to re-request state from server.
    // Handled by the socket 'connect' listener in useSocket.
    socket.emit('state:request', (serverState: any) => {
      _store.setVisualState(serverState as Exclude<typeof serverState, 'TRANSITIONING'>)
    })
    socket.emit('desktop:state:request', (payload: any) => {
      _store.syncDesktopRuntimeState(payload)
    })
  },

  // ── Config signals ─────────────────────────────────────────────

  'config:update': (config: AppConfig, store) => {
    store.setConfig(config)
  },

  'config:patch': (updates: Partial<AppConfig>, store) => {
    store.patchConfig(updates)
  },

  'runtime:config': (updates: RuntimeConfig, store) => {
    store.setRuntimeConfig(updates)
  },

  // ── Widget / desktop signals ───────────────────────────────────

  'widget:toggle': (widgetId: string, store) => {
    store.toggleWidget(widgetId)
  },

  'widget:simulate:intent': (payload: WidgetSimulationIntentPayload, _store) => {
    dispatchWidgetSimulationIntent(payload)
  },

  'widget:chain:action': (payload: { targetWidgetId: string; action: string; sourceSignal: unknown }, _store) => {
    dispatchWidgetChainAction({ targetWidgetId: payload.targetWidgetId, action: payload.action, sourceSignal: payload.sourceSignal })
  },

  'desktop:notify': (payload: DesktopNotificationPayload, store) => {
    store.enqueueDesktopNotification({
      ...payload,
      durationMs: payload.durationMs ?? DEFAULT_DESKTOP_NOTIFICATION_DURATION_MS,
    })
  },

  'desktop:recycle-bin': (payload: DesktopRecycleBinPayload, store) => {
    store.setRecycleBinFull(payload.full)
  },

  'overlay:owner': (payload: { socketId: string | null }, store) => {
    store.setOverlayOwnerSocketId(payload.socketId)
  },

  'obs:status': (payload: ObsStatusPayload, store) => {
    store.setObsConnected(payload.connected)
  },

  // ── Cursor mirror signals ──────────────────────────────────────

  'cursor:mirror': (payload: CursorMirrorPayload, _store) => {
    const cursor = (window as any).__cursorOverlayController
    if (!cursor) return
    const locked = Date.now() < menuTimelineLockUntil
    if (locked && (payload.kind === 'move' || payload.kind === 'click')) return

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
  },

  'cursor:mirror:menu-timeline': (payload: OpenWidgetMenuTimelinePayload, _store) => {
    const cursor = (window as any).__cursorOverlayController
    if (!cursor) return
    const totalMs =
      payload.startMoveMs +
      payload.startPostMs +
      payload.steps.reduce((sum, step) => sum + step.moveMs + step.hoverMs + step.postMs, 0)
    menuTimelineLockUntil = Date.now() + totalMs + 400
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
  },

  // ── Ambiance signals ───────────────────────────────────────────
  // Note: 'ambiance:simulate' is handled by Desktop.tsx which owns the
  // simulation queue, cursor control, and ack/start/done lifecycle.
  // The overlay is always the simulation executor (single slot system).
}
