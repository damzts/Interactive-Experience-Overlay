// ── POV Switching Domain Types ────────────────────────────────────

/** Connection status of a camera feed */
export type CameraConnectionStatus =
  | 'connected'
  | 'disconnected'
  | 'reconnecting'
  | 'unresponsive'
  | 'unreachable'

/** A single registered camera feed representing one player's OBS instance */
export interface CameraFeed {
  id: string
  label: string
  obsAddress: string
  obsPassword: string
  sceneName: string
  connectionStatus: CameraConnectionStatus
  connectedAt: number | null
  registeredAt: number
  lastHealthCheck: number | null
  activityScore: number
}

/** Switching mode: automatic (audio-driven) or manual (host-selected) */
export type SwitchMode = 'automatic' | 'manual'

/** Transition type for camera switches */
export interface TransitionConfig {
  type: 'cut' | 'fade'
  durationMs: number
}

/** A queued switch request waiting for execution */
export interface QueuedSwitch {
  feedId: string
  timestamp: number
}

/** Persisted POV switching configuration */
export interface POVSwitchingConfig {
  pollIntervalMs: number
  rollingWindowMs: number
  cooldownMs: number
  activityThreshold: number
  silenceThreshold: number
  healthCheckIntervalMs: number
  maxConnections: number
  transition: TransitionConfig
  scoreEmitIntervalMs: number
  dbFloor: number
  dbCeiling: number
}

/** In-memory runtime state for the POV switching system */
export interface POVRuntimeState {
  mode: SwitchMode
  activeCameraId: string | null
  lastSwitchTimestamp: number | null
  transitionInProgress: boolean
  transitionQueue: QueuedSwitch[]
  scores: Map<string, number>
  connectionStatuses: Map<string, CameraConnectionStatus>
}
