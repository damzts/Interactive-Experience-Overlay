import type { STATE } from './state.js'

// ── Overlay client types ─────────────────────────────────────────
// These live in diagnostics because they primarily appear in diagnostic payloads
// and are referenced by socket.ts (one-way dependency).

export type OverlayClientKind = 'runtime' | 'dev' | 'unknown'
export type CameraPermissionState = 'unknown' | 'prompt' | 'granted' | 'denied' | 'unsupported'

export interface OverlayClientDiagnostics {
  socketId: string
  kind: OverlayClientKind
  port: string | null
  label: string
  mounted: boolean
  cursorReady: boolean
  widgetRegistryReady: boolean
  ready: boolean
  readyAt: number | null
  lastHeartbeatAt: number | null
  cameraPermission: CameraPermissionState
}

// ── Ambiance history ─────────────────────────────────────────────

export interface AmbianceHistoryEntry {
  id: string
  timestamp: number
  type:
    | 'leader-elected'
    | 'leader-cleared'
    | 'leader-expired'
    | 'simulate-dispatched'
    | 'simulate-accepted'
    | 'simulate-started'
    | 'simulate-done'
    | 'simulate-accept-timeout'
    | 'simulate-start-timeout'
    | 'simulate-completion-timeout'
    | 'resync-requested'
  message: string
  actionId?: string
  widgetId?: string
  action?: 'open' | 'close' | 'interact'
  leaderSocketId?: string | null
}

// ── OBS diagnostics ──────────────────────────────────────────────

export interface ObsStatusPayload {
  connected: boolean
  url: string
  reconnecting: boolean
  reconnectAttempt: number
  retryDelayMs: number | null
  nextRetryAt: number | null
  lastError: string | null
  virtualCamActive: boolean
  streaming: boolean
  recording?: boolean
  overlaySourceAdded: boolean
}

// ── Scheduler diagnostics ─────────────────────────────────────────

export interface SchedulerEventDiagnostics {
  id: string
  label: string
  enabled: boolean
  mode: 'interval' | 'idle'
  effectsCount: number
  actionsCount: number
  intervalMin: number
  idleMin: number
  chance: number
  cooldownMin: number
  allowedStates?: STATE[]
  nextRunAt: number | null
  idleTriggered: boolean
  due: boolean
}

export interface SchedulerDiagnosticsPayload {
  nextFireAt: number | null
  currentState: STATE
  lastProcessedAt: number | null
  lastActivityAt: number
  lastTriggeredEventId: string | null
  lastTriggeredAt: number | null
  activeEventCount: number
  events: SchedulerEventDiagnostics[]
}

// ── Ambiance diagnostics ──────────────────────────────────────────

export interface AmbianceDiagnosticsPayload {
  enabled: boolean
  intervalSeconds: number
  lastStartedAt: number | null
  lastTickAt: number | null
  lastActionAt: number | null
  lastActionWidgetId: string | null
  lastAction: 'open' | 'close' | 'interact' | null
  inFlight: boolean
  pendingPhase: 'pending' | 'running' | null
  pendingActionId: string | null
  leaderSocketId: string | null
  /** Whether the overlay has reported itself ready to execute simulations */
  overlayReady: boolean
  history: AmbianceHistoryEntry[]
  openWidgetCount: number
  enabledWidgetCount: number
  maxOpenWidgets: number
  openWhileOneOpenChance: number
  lastSkipReason: string | null
}

// ── Combined runtime diagnostics ─────────────────────────────────

export interface RuntimeDiagnosticsPayload {
  scheduler: SchedulerDiagnosticsPayload
  ambiance: AmbianceDiagnosticsPayload
  /** Lifecycle status of each registered kernel manager, keyed by manager.name */
  managers?: Record<string, import('./manager.js').ManagerStatus>
}
