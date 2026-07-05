/**
 * Admin signal handler registry.
 *
 * Declarative map of every Kernel → Admin signal and how the admin reacts.
 * useSocketEvents iterates this map on mount.
 *
 * Adding a new signal = add one entry here.
 */

import { STATE } from '@ieomlabs/shared'
import type { ObsStatusPayload, RuntimeDiagnosticsPayload, ServerToClientEvents } from '@ieomlabs/shared'
import type { AdminStore } from '../store/useAdminStore'

export type AdminSignalHandler<T> = (payload: T, store: AdminStore) => void

export type AdminSignalHandlerMap = {
  [K in keyof ServerToClientEvents]?: AdminSignalHandler<Parameters<ServerToClientEvents[K]>[0]>
}

export const adminSignalHandlers: AdminSignalHandlerMap = {
  'state:update': ({ state }: { state: STATE }, store) => {
    if (state !== STATE.TRANSITIONING) store.setCurrentState(state)
  },

  'widget:toggle': (widgetId: string, store) => {
    store.toggleWidgetRuntimeState(widgetId)
  },

  'desktop:recycle-bin': ({ full }: { full: boolean }, store) => {
    store.setRecycleBinFull(full)
  },

  'obs:status': (payload: ObsStatusPayload, store) => {
    store.setObsStatus(payload)
  },

  'config:update': (config, store) => {
    store.setConfig(config)
  },

  'config:patch': (updates, store) => {
    store.patchConfig(updates)
  },

  'runtime:config': (updates, store) => {
    store.setRuntimeConfig(updates)
  },

  'overlay:owner': ({ socketId }: { socketId: string | null }, store) => {
    store.setOverlayOwnerSocketId(socketId)
  },

  'ambiance:metrics': (payload: { accepted: number; rejected: number }, store) => {
    store.setAmbianceMetrics(payload)
  },

  'runtime:diagnostics': (payload: RuntimeDiagnosticsPayload, store) => {
    store.setRuntimeDiagnostics(payload)
  },

  // Generic domain-event channel — BusFrame envelopes for public kernel
  // events (see KernelSignalMap in @ieomlabs/shared). Admin only reacts to
  // the few it surfaces; everything else flows through untouched.
  'kernel:signal': (frame, store) => {
    switch (frame.event) {
      case 'chat:connected':
        store.setTwitchConnected(true, (frame.payload as { channel: string }).channel)
        break
      case 'twitch:eventsub:connected':
        store.setTwitchEventSubConnected(true)
        break
    }
  },
}
