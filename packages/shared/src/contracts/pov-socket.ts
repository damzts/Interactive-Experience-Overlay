import type { CameraConnectionStatus, SwitchMode } from '../domain/pov.js'

// ── POV Socket Event Payloads ────────────────────────────────────

/** Full POV system status broadcast to admin clients */
export interface POVStatusPayload {
  mode: SwitchMode
  activeCameraId: string | null
  feeds: Array<{
    id: string
    label: string
    connectionStatus: CameraConnectionStatus
    activityScore: number
  }>
}

/** Emitted when the active camera switches */
export interface POVSwitchPayload {
  previousFeedId: string | null
  newFeedId: string
  timestamp: number
  reason: 'automatic' | 'manual' | 'fallback'
}

/** Periodic activity score broadcast */
export interface POVScoresPayload {
  scores: Array<{ feedId: string; score: number }>
  timestamp: number
}

/** Emitted when a single feed's connection status changes */
export interface POVFeedStatusPayload {
  feedId: string
  connectionStatus: CameraConnectionStatus
  label: string
}

/** Emitted on POV-related errors */
export interface POVErrorPayload {
  feedId?: string
  message: string
  code: 'capacity_reached' | 'feed_unavailable' | 'transition_failed' | 'connection_failed'
}
