/**
 * Signal handler registry.
 *
 * Declarative map of every Kernel → Userspace signal and how the overlay
 * responds to it. useSignalReceiver iterates this map on mount and registers
 * all socket.on() handlers in one place.
 *
 * Adding a new signal = add one entry here. No hook hunting.
 */

import { withDesktopConfigDefaults, DEFAULT_DESKTOP_NOTIFICATION_DURATION_MS, EFFECT_CATALOG } from '@ieomlabs/shared'
import type {
  DesktopNotificationPayload,
  ObsStatusPayload,
  PresentationStatePayload,
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
import { dispatchWidgetSimulationIntent, dispatchWidgetChainAction, dispatchWidgetSignal } from '../desktop/widgetSimulationEvents'
import { PRESENTATION_KEY_RECYCLE_BIN, readRecycleBinState } from '../desktop/presentationState'
import { socket } from './client'
import type { AppStore } from '../store/useAppStore'

// ── Types ────────────────────────────────────────────────────────

export type SignalHandler<T> = (payload: T, store: AppStore) => void

export type SignalHandlerMap = {
  [K in keyof ServerToClientEvents]?: SignalHandler<
    Parameters<ServerToClientEvents[K]>[0]
  >
}

// ── Effect firing (with delay + chained-effect support) ───────────

function fireEffect(eff: EffectConfig, store: AppStore): void {
  // Per-effect stack conditions — checked before any sound/visual dispatch,
  // so a skipped effect makes no sound either.
  if (eff.sceneIs?.length && !eff.sceneIs.includes(store.visualState)) return
  if (eff.chance !== undefined && Math.random() >= eff.chance) return

  // audio-sfx: play sound from cfg, no visual dispatch
  if (eff.type === 'audio-sfx') {
    const audioCfg = eff.cfg as import('@ieomlabs/shared').AudioSfxConfig
    if (audioCfg.sfxId === 'custom' && audioCfg.customUrl) {
      void audioEngine.playUrl(audioCfg.customUrl)
    } else if (audioCfg.sfxId !== 'custom') {
      audioEngine.play(audioCfg.sfxId as Parameters<typeof audioEngine.play>[0])
    }
  } else {
    dispatchEffect(eff.type, eff.cfg)
    if (eff.sfx) {
      // Custom sfx: URL path gets playUrl(), bare ID gets play()
      if (eff.sfx.includes('/')) {
        void audioEngine.playUrl(eff.sfx)
      } else {
        audioEngine.play(eff.sfx as Parameters<typeof audioEngine.play>[0])
      }
    } else {
      // Default sound comes from the effect's catalog manifest
      const sfxId = EFFECT_CATALOG[eff.type]?.defaultSfx
      if (sfxId) audioEngine.play(sfxId as Parameters<typeof audioEngine.play>[0])
    }
  }

  if (eff.chain && Math.random() < eff.chain.chance) {
    scheduleEffect(eff.chain.effect, store)
  }
}

/** Schedule an effect to fire after its `delay` (seconds), then evaluate its chain. */
function scheduleEffect(eff: EffectConfig, store: AppStore): void {
  const delay = eff.delay ?? 0
  if (delay > 0) setTimeout(() => fireEffect(eff, store), delay * 1000)
  else fireEffect(eff, store)
}

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

  'overlay:show': (payload: OverlayTriggerPayload, store) => {
    const { effects } = payload
    if (!effects.length) return
    effects.forEach((eff) => scheduleEffect(eff, store))
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

  // Server-minted signal (signal:emit automation action) — re-enter it on the DOM
  // bus so widgets, renderers, and widget-source rules can react. The useSocket
  // forwarder skips synthetic payloads, so this cannot ping-pong back to the server.
  'widget:signal': (payload: { source: string; event: string; payload: unknown }, _store) => {
    dispatchWidgetSignal({ source: payload.source, event: payload.event, payload: payload.payload })
  },

  'desktop:notify': (payload: DesktopNotificationPayload, store) => {
    store.enqueueDesktopNotification({
      ...payload,
      durationMs: payload.durationMs ?? DEFAULT_DESKTOP_NOTIFICATION_DURATION_MS,
    })
  },

  // Generic presentation relay — this map handles the recycle-bin key;
  // Desktop.tsx owns the start-menu key (it holds that state locally).
  'presentation:state': (payload: PresentationStatePayload, store) => {
    const bin = readRecycleBinState({ [PRESENTATION_KEY_RECYCLE_BIN]: payload.value })
    if (payload.key === PRESENTATION_KEY_RECYCLE_BIN && bin) store.setRecycleBinFull(bin.full)
  },

  'overlay:owner': (payload: { socketId: string | null }, store) => {
    store.setOverlayOwnerSocketId(payload.socketId)
  },

  'obs:status': (payload: ObsStatusPayload, store) => {
    store.setObsConnected(payload.connected)
  },

  // ── Ambiance signals ───────────────────────────────────────────
  // Note: 'ambiance:simulate' is handled by Desktop.tsx which owns the
  // simulation queue, cursor control, and ack/start/done lifecycle.
  // The overlay is always the simulation executor (single slot system).
}
