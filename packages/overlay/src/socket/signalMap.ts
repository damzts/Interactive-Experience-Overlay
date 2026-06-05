/**
 * Signal handler registry.
 *
 * Declarative map of every Kernel → Userspace signal and how the overlay
 * responds to it. useSignalReceiver iterates this map on mount and registers
 * all socket.on() handlers in one place.
 *
 * Adding a new signal = add one entry here. No hook hunting.
 */

import { withDesktopConfigDefaults, DEFAULT_DESKTOP_NOTIFICATION_DURATION_MS } from '@ieom/shared'
import type {
  AmbianceSimulationPayload,
  CursorMirrorPayload,
  DesktopNotificationPayload,
  DesktopRecycleBinPayload,
  DesktopStartMenuSimulationPhasePayload,
  DesktopStartMenuStatePayload,
  ObsStatusPayload,
  OpenWidgetMenuTimelinePayload,
  RuntimeConfigOverridePayload,
  TransitionPlayPayload,
  WidgetSimulationIntentPayload,
  ServerToClientEvents,
  AppConfig,
  EffectConfig,
  OverlayTriggerPayload,
} from '@ieom/shared'
import { dispatchEffect } from '../effects/registry'
import '../effects/index'
import { audioEngine } from '../engine/AudioEngine'
import { dispatchWidgetSimulationIntent } from '../desktop/widgetSimulationEvents'
import { runWidgetCursorSimulation } from '../desktop/cursorSimUtils'
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
    // Reactive icon pulse
    const desktopConfig = withDesktopConfigDefaults(store.config.desktopConfig)
    if (desktopConfig.iconAnimation === 'reactive') {
      const sceneApp = store.config.applications.find(
        (app) => app.appType === 'scene' && (app as any).targetSceneId === next,
      )
      if (sceneApp) {
        store.setReactiveIconId(sceneApp.id)
        setTimeout(() => store.setReactiveIconId(null), 720)
      }
    }
  },

  'transition:play': (payload: TransitionPlayPayload, store) => {
    audioEngine.play('transition')
    store.setPendingTransition(payload)
  },

  'overlay:show': (payload: OverlayTriggerPayload, _store) => {
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
  },

  'overlay:resync': (_payload, store) => {
    // Trigger a full resync by re-requesting state from the server.
    // The store's connect handler will fire — handled by useSignalReceiver reconnect logic.
    // We dispatch a synthetic connect event so scene/desktop state is re-fetched.
    store.syncDesktopRuntimeState({ openWidgetIds: [], recycleBinFull: false })
  },

  // ── Config signals ─────────────────────────────────────────────

  'config:update': (config: AppConfig, store) => {
    store.setConfig(config)
  },

  'config:patch': (updates: Partial<AppConfig>, store) => {
    store.patchConfig(updates)
  },

  'runtime:config:override': (updates: RuntimeConfigOverridePayload, store) => {
    store.setRuntimeConfigOverride(updates)
  },

  // ── Widget / desktop signals ───────────────────────────────────

  'widget:toggle': (widgetId: string, store) => {
    store.toggleWidget(widgetId)
  },

  'widget:simulate:intent': (payload: WidgetSimulationIntentPayload, _store) => {
    dispatchWidgetSimulationIntent(payload)
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
  // Note: 'ambiance:simulate' and 'ambiance:leader' / 'ambiance:metrics' are
  // handled by the ambiance-specific hooks in Desktop.tsx, which have
  // complex stateful logic (leader management, ack/done flow).
  // They can be migrated here incrementally.
}
