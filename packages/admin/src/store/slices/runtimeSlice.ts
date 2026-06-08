import type { StateCreator } from 'zustand'
import { STATE } from '@ieomlabs/shared'
import type { DesktopRuntimeStatePayload, ManagerStatus, ObsStatusPayload, RuntimeDiagnosticsPayload } from '@ieomlabs/shared'

export interface RuntimeSlice {
  currentState: STATE
  obsConnected: boolean
  obsStatus: ObsStatusPayload
  clientCount: number
  overlayOwnerSocketId: string | null
  openWidgetIds: string[]
  recycleBinFull: boolean
  ambianceAcceptedCount: number
  ambianceRejectedCount: number
  runtimeDiagnostics: RuntimeDiagnosticsPayload

  setCurrentState: (s: STATE) => void
  setObsStatus: (status: ObsStatusPayload) => void
  setClientCount: (n: number) => void
  setOverlayOwnerSocketId: (socketId: string | null) => void
  syncDesktopRuntimeState: (payload: DesktopRuntimeStatePayload) => void
  toggleWidgetRuntimeState: (widgetId: string) => void
  setRecycleBinFull: (full: boolean) => void
  setAmbianceMetrics: (payload: { accepted: number; rejected: number }) => void
  setRuntimeDiagnostics: (payload: RuntimeDiagnosticsPayload) => void
}

export const createRuntimeSlice: StateCreator<RuntimeSlice, [], [], RuntimeSlice> = (set) => ({
  currentState: STATE.DESKTOP,
  obsConnected: false,
  obsStatus: {
    connected: false,
    url: 'ws://localhost:4455',
    reconnecting: false,
    reconnectAttempt: 0,
    retryDelayMs: null,
    nextRetryAt: null,
    lastError: null,
  },
  clientCount: 0,
  overlayOwnerSocketId: null,
  openWidgetIds: [],
  recycleBinFull: false,
  ambianceAcceptedCount: 0,
  ambianceRejectedCount: 0,
  runtimeDiagnostics: {
    scheduler: {
      nextFireAt: null,
      currentState: STATE.DESKTOP,
      lastProcessedAt: null,
      lastActivityAt: Date.now(),
      lastTriggeredEventId: null,
      lastTriggeredAt: null,
      activeEventCount: 0,
      events: [],
    },
    ambiance: {
      enabled: false,
      intervalSeconds: 30,
      lastStartedAt: null,
      lastTickAt: null,
      lastActionAt: null,
      lastActionWidgetId: null,
      lastAction: null,
      inFlight: false,
      pendingPhase: null,
      pendingActionId: null,
      leaderSocketId: null,
      overlayReady: false,
      history: [],
      openWidgetCount: 0,
      enabledWidgetCount: 0,
      maxOpenWidgets: 2,
      openWhileOneOpenChance: 0.35,
      lastSkipReason: null,
    },
  },

  setCurrentState: (s) => set({ currentState: s }),
  setObsStatus: (status) => set({ obsConnected: status.connected, obsStatus: status }),
  setClientCount: (n) => set({ clientCount: n }),
  setOverlayOwnerSocketId: (overlayOwnerSocketId) => set({ overlayOwnerSocketId }),
  syncDesktopRuntimeState: (payload) =>
    set({ openWidgetIds: payload.openWidgetIds, recycleBinFull: payload.recycleBinFull }),
  toggleWidgetRuntimeState: (widgetId) =>
    set((state) => ({
      openWidgetIds: state.openWidgetIds.includes(widgetId)
        ? state.openWidgetIds.filter((id) => id !== widgetId)
        : [...state.openWidgetIds, widgetId],
    })),
  setRecycleBinFull: (full) => set({ recycleBinFull: full }),
  setAmbianceMetrics: (payload) =>
    set({ ambianceAcceptedCount: payload.accepted, ambianceRejectedCount: payload.rejected }),
  setRuntimeDiagnostics: (payload) => set({ runtimeDiagnostics: payload }),
})
