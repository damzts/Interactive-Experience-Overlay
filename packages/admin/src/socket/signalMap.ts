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

  'runtime:config:override': (updates, store) => {
    store.setRuntimeConfigOverride(updates)
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

  'chat:connected': ({ channel }: { channel: string }, store) => {
    store.setTwitchConnected(true, channel)
  },
}
