import type { SwitchMode } from '../domain/pov.js'
import type {
  OnlineRoomStatus,
  ParticipantInfo,
  SwitchReason,
} from '../domain/online.js'
import type { RTCSessionDescriptionInit, RTCIceCandidateInit } from './webrtc-types.js'

// ── WebRTC Signaling ─────────────────────────────────────────────

/** WebRTC signaling message relayed between peers via the server */
export interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate'
  from: string
  to: string
  roomCode: string
  payload: RTCSessionDescriptionInit | RTCIceCandidateInit
}

// ── Server → Client (Admin) Event Payloads ───────────────────────

export interface OnlineRoomCreatedPayload {
  roomCode: string
  joinUrl: string
  createdAt: number
}

export interface OnlineRoomClosedPayload {
  roomCode: string
}

export interface OnlineRoomIdlePayload {
  roomCode: string
}

export interface OnlineParticipantJoinedPayload {
  roomCode: string
  participant: ParticipantInfo
}

export interface OnlineParticipantLeftPayload {
  roomCode: string
  participantId: string
}

export interface OnlineScoresPayload {
  roomCode: string
  scores: Array<{ participantId: string; score: number }>
  timestamp: number
}

export interface OnlineSwitchPayload {
  roomCode: string
  previousId: string | null
  newId: string
  timestamp: number
  reason: SwitchReason
}

// ── Server → Client (Player) Event Payloads ──────────────────────

export interface OnlineJoinedPayload {
  participantId: string
  roomCode: string
  participants: ParticipantInfo[]
}

export interface OnlineJoinErrorPayload {
  error: string
  code: 'room_not_found' | 'room_full' | 'invalid_name'
}

export interface OnlinePeerJoinedPayload {
  participantId: string
  displayName: string
}

export interface OnlinePeerLeftPayload {
  participantId: string
}

// ── Server → Client (Overlay) Event Payloads ─────────────────────

export interface OnlineOverlaySwitchPayload {
  previousId: string | null
  newId: string
  timestamp: number
}

// ── Client → Server Event Payloads ───────────────────────────────

export interface OnlineJoinPayload {
  roomCode: string
  displayName: string
}

export interface OnlineAudioLevelPayload {
  level: number
}

export interface OnlineRoomClosePayload {
  roomCode: string
}

export interface OnlineModeSetPayload {
  roomCode: string
  mode: SwitchMode
}

export interface OnlineSelectPayload {
  roomCode: string
  participantId: string
}

export interface OnlineOverlaySubscribePayload {
  roomCode: string
}

// ── Socket.IO Event Maps for /online Namespace ───────────────────

/** Events the server sends to admin clients on the /online namespace */
export interface OnlineServerToAdminEvents {
  'pov-online:room:created': (payload: OnlineRoomCreatedPayload) => void
  'pov-online:room:closed': (payload: OnlineRoomClosedPayload) => void
  'pov-online:room:idle': (payload: OnlineRoomIdlePayload) => void
  'pov-online:participant:joined': (payload: OnlineParticipantJoinedPayload) => void
  'pov-online:participant:left': (payload: OnlineParticipantLeftPayload) => void
  'pov-online:scores': (payload: OnlineScoresPayload) => void
  'pov-online:switch': (payload: OnlineSwitchPayload) => void
  'pov-online:status': (payload: OnlineRoomStatus) => void
}

/** Events the server sends to player clients on the /online namespace */
export interface OnlineServerToPlayerEvents {
  'pov-online:joined': (payload: OnlineJoinedPayload) => void
  'pov-online:join:error': (payload: OnlineJoinErrorPayload) => void
  'pov-online:peer:joined': (payload: OnlinePeerJoinedPayload) => void
  'pov-online:peer:left': (payload: OnlinePeerLeftPayload) => void
  'pov-online:room:closed': (payload: OnlineRoomClosedPayload) => void
}

/** Events the server sends to overlay clients on the /online namespace */
export interface OnlineServerToOverlayEvents {
  'pov-online:switch': (payload: OnlineOverlaySwitchPayload) => void
  'pov-online:peer:joined': (payload: OnlinePeerJoinedPayload) => void
  'pov-online:peer:left': (payload: OnlinePeerLeftPayload) => void
}

/**
 * Combined server-to-client events for the /online namespace.
 * Since different roles receive different payloads for the same event name
 * (e.g. pov-online:switch), this union uses the most general signatures.
 * Prefer the role-specific interfaces (OnlineServerToAdminEvents, etc.)
 * when working with a known client role.
 */
export interface OnlineServerToClientEvents {
  'pov-online:room:created': (payload: OnlineRoomCreatedPayload) => void
  'pov-online:room:closed': (payload: OnlineRoomClosedPayload) => void
  'pov-online:room:idle': (payload: OnlineRoomIdlePayload) => void
  'pov-online:participant:joined': (payload: OnlineParticipantJoinedPayload) => void
  'pov-online:participant:left': (payload: OnlineParticipantLeftPayload) => void
  'pov-online:scores': (payload: OnlineScoresPayload) => void
  'pov-online:switch': (payload: OnlineSwitchPayload | OnlineOverlaySwitchPayload) => void
  'pov-online:status': (payload: OnlineRoomStatus) => void
  'pov-online:joined': (payload: OnlineJoinedPayload) => void
  'pov-online:join:error': (payload: OnlineJoinErrorPayload) => void
  'pov-online:peer:joined': (payload: OnlinePeerJoinedPayload) => void
  'pov-online:peer:left': (payload: OnlinePeerLeftPayload) => void
}

/** Events clients send to the server on the /online namespace */
export interface OnlineClientToServerEvents {
  'pov-online:join': (
    payload: OnlineJoinPayload,
    ack: (response: { ok: boolean; participantId?: string; error?: string }) => void
  ) => void
  'pov-online:audio-level': (payload: OnlineAudioLevelPayload) => void
  'pov-online:signal': (payload: SignalingMessage) => void
  'pov-online:room:create': (
    ack: (response: { ok: boolean; roomCode?: string; joinUrl?: string; error?: string }) => void
  ) => void
  'pov-online:room:close': (payload: OnlineRoomClosePayload) => void
  'pov-online:mode:set': (payload: OnlineModeSetPayload) => void
  'pov-online:select': (
    payload: OnlineSelectPayload,
    ack: (response: { ok: boolean; error?: string }) => void
  ) => void
  'pov-online:overlay:subscribe': (payload: OnlineOverlaySubscribePayload) => void
}

/** Inter-server events for the /online namespace */
export interface OnlineInterServerEvents {}

/** Socket data for the /online namespace */
export interface OnlineSocketData {
  userId?: string
  participantId?: string
  roomCode?: string
  role?: 'player' | 'admin' | 'overlay'
}
