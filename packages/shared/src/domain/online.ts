import type { TransitionConfig, SwitchMode } from './pov.js'

// ── Room Domain Types ─────────────────────────────────────────────

/** Reason for an active player switch in online mode */
export type SwitchReason = 'automatic' | 'manual' | 'fallback'

/** Persisted configuration for a room */
export interface RoomConfig {
  /** Interval at which players send audio level reports (ms). Default 100, range 50-500 */
  audioReportIntervalMs: number
  /** Rolling window for activity score computation (ms). Default 2000, range 500-10000 */
  rollingWindowMs: number
  /** Cooldown between automatic switches (ms). Default 3000, range 1000-30000 */
  cooldownMs: number
  /** Minimum score difference to trigger a switch. Default 0.15, range 0.01-1.0 */
  activityThreshold: number
  /** Score below which a player is considered silent. Default 0.05, range 0.0-1.0 */
  silenceThreshold: number
  /** Maximum players allowed per room. Default 10, range 2-20 */
  maxPlayersPerRoom: number
  /** Maximum simultaneously active rooms. Default 5, range 1-10 */
  maxActiveRooms: number
  /** Interval at which scores are emitted to admin (ms). Default 500 */
  scoreEmitIntervalMs: number
  /** Time before an empty room is marked idle (ms). Default 60000 */
  idleTimeoutMs: number
  /** Transition configuration for overlay switches */
  transition: TransitionConfig
}

/** Information about a participant in a room */
export interface ParticipantInfo {
  id: string
  displayName: string
  connectionStatus: 'connected' | 'disconnected'
  activityScore: number
  joinedAt: number
}

/** Full status of a room */
export interface RoomStatus {
  roomCode: string
  createdAt: number
  status: 'active' | 'idle'
  maxPlayers: number
  participantCount: number
  participants: ParticipantInfo[]
  activePlayerId: string | null
  mode: SwitchMode
  hubConnected: boolean
}

// ── Defaults ─────────────────────────────────────────────────────

export const DEFAULT_ROOM_CONFIG: RoomConfig = {
  audioReportIntervalMs: 100,
  rollingWindowMs: 2000,
  cooldownMs: 3000,
  activityThreshold: 0.15,
  silenceThreshold: 0.05,
  maxPlayersPerRoom: 10,
  maxActiveRooms: 5,
  scoreEmitIntervalMs: 500,
  idleTimeoutMs: 60000,
  transition: { type: 'cut', durationMs: 0 },
}

// ── Bounds ───────────────────────────────────────────────────────

export interface RoomConfigBounds {
  min: number
  max: number
}

export const ROOM_CONFIG_BOUNDS: Record<string, RoomConfigBounds> = {
  audioReportIntervalMs: { min: 50, max: 500 },
  rollingWindowMs: { min: 500, max: 10000 },
  cooldownMs: { min: 1000, max: 30000 },
  activityThreshold: { min: 0.01, max: 1.0 },
  silenceThreshold: { min: 0.0, max: 1.0 },
  maxPlayersPerRoom: { min: 2, max: 20 },
  maxActiveRooms: { min: 1, max: 10 },
}

// ── Backward-compat aliases ───────────────────────────────────────

/** @deprecated Use RoomConfig */
export type OnlineModeConfig = RoomConfig
/** @deprecated Use RoomStatus */
export type OnlineRoomStatus = RoomStatus
/** @deprecated Use RoomConfigBounds */
export type OnlineConfigBounds = RoomConfigBounds
/** @deprecated Use DEFAULT_ROOM_CONFIG */
export const DEFAULT_ONLINE_MODE_CONFIG = DEFAULT_ROOM_CONFIG
/** @deprecated Use ROOM_CONFIG_BOUNDS */
export const ONLINE_CONFIG_BOUNDS = ROOM_CONFIG_BOUNDS
