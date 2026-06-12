import type { SwitchMode } from '../domain/pov.js'
import type {
  RoomStatus,
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

export interface RoomCreatedPayload {
  roomCode: string
  joinUrl: string
  createdAt: number
}

export interface RoomClosedPayload {
  roomCode: string
}

export interface RoomIdlePayload {
  roomCode: string
}

export interface RoomParticipantJoinedPayload {
  roomCode: string
  participant: ParticipantInfo
}

export interface RoomParticipantLeftPayload {
  roomCode: string
  participantId: string
}

export interface RoomScoresPayload {
  roomCode: string
  scores: Array<{ participantId: string; score: number }>
  timestamp: number
}

export interface RoomSwitchPayload {
  roomCode: string
  previousId: string | null
  newId: string
  timestamp: number
  reason: SwitchReason
}

// ── Server → Client (Player) Event Payloads ──────────────────────

export interface RoomJoinedPayload {
  participantId: string
  roomCode: string
  participants: ParticipantInfo[]
}

export interface RoomJoinErrorPayload {
  error: string
  code: 'room_not_found' | 'room_full' | 'invalid_name'
}

export interface RoomPeerJoinedPayload {
  participantId: string
  displayName: string
}

export interface RoomPeerLeftPayload {
  participantId: string
}

// ── Server → Client (Overlay) Event Payloads ─────────────────────

export interface RoomOverlaySwitchPayload {
  previousId: string | null
  newId: string
  timestamp: number
}

// ── Client → Server Event Payloads ───────────────────────────────

export interface RoomJoinPayload {
  roomCode: string
  displayName: string
}

export interface RoomAudioLevelPayload {
  level: number
}

export interface RoomClosePayload {
  roomCode: string
}

export interface RoomModeSetPayload {
  roomCode: string
  mode: SwitchMode
}

export interface RoomSelectPayload {
  roomCode: string
  participantId: string
}

export interface RoomOverlaySubscribePayload {
  roomCode: string
}

// ── Admin preview WebRTC relay events ──────────────────────────

/** Info about one participant's video stream */
export interface RoomPreviewStreamInfo {
  userId: string
  displayName: string
  hasVideo: boolean
  hasAudio: boolean
}

/** Server → admin: new WebRTC offer for a participant's stream */
export interface RoomPreviewOfferPayload {
  userId: string
  sdp: string
  displayName: string
  hasAudio: boolean
  hasVideo: boolean
}

/** Admin → server: answer to a stream offer */
export interface RoomPreviewAnswerPayload {
  userId: string
  sdp: string
}

/** Admin → server: ICE candidate for a participant's stream */
export interface RoomPreviewIcePayload {
  userId: string
  candidate: unknown
}

/** Server → admin: a participant's stream was removed */
export interface RoomPreviewRemovedPayload {
  userId: string
}

// ── Socket.IO Event Maps for /room Namespace ─────────────────────

/** Events the server sends to admin clients on the /room namespace */
export interface RoomServerToAdminEvents {
  'pov-online:room:created': (payload: RoomCreatedPayload) => void
  'pov-online:room:closed': (payload: RoomClosedPayload) => void
  'pov-online:room:idle': (payload: RoomIdlePayload) => void
  'pov-online:participant:joined': (payload: RoomParticipantJoinedPayload) => void
  'pov-online:participant:left': (payload: RoomParticipantLeftPayload) => void
  'pov-online:scores': (payload: RoomScoresPayload) => void
  'pov-online:switch': (payload: RoomSwitchPayload) => void
  'pov-online:status': (payload: RoomStatus) => void
  'pov-online:preview:offer': (payload: RoomPreviewOfferPayload) => void
  'pov-online:preview:ice': (payload: RoomPreviewIcePayload) => void
  'pov-online:preview:removed': (payload: RoomPreviewRemovedPayload) => void
  'pov-online:preview:status': (payload: RoomPreviewStreamInfo[]) => void
}

/** Events the server sends to player clients on the /room namespace */
export interface RoomServerToPlayerEvents {
  'pov-online:joined': (payload: RoomJoinedPayload) => void
  'pov-online:join:error': (payload: RoomJoinErrorPayload) => void
  'pov-online:peer:joined': (payload: RoomPeerJoinedPayload) => void
  'pov-online:peer:left': (payload: RoomPeerLeftPayload) => void
  'pov-online:room:closed': (payload: RoomClosedPayload) => void
}

/** Events the server sends to overlay clients on the /room namespace */
export interface RoomServerToOverlayEvents {
  'pov-online:switch': (payload: RoomOverlaySwitchPayload) => void
  'pov-online:peer:joined': (payload: RoomPeerJoinedPayload) => void
  'pov-online:peer:left': (payload: RoomPeerLeftPayload) => void
}

/**
 * Combined server-to-client events for the /room namespace.
 * Prefer the role-specific interfaces (RoomServerToAdminEvents, etc.)
 * when working with a known client role.
 */
export interface RoomServerToClientEvents {
  'pov-online:room:created': (payload: RoomCreatedPayload) => void
  'pov-online:room:closed': (payload: RoomClosedPayload) => void
  'pov-online:room:idle': (payload: RoomIdlePayload) => void
  'pov-online:participant:joined': (payload: RoomParticipantJoinedPayload) => void
  'pov-online:participant:left': (payload: RoomParticipantLeftPayload) => void
  'pov-online:scores': (payload: RoomScoresPayload) => void
  'pov-online:switch': (payload: RoomSwitchPayload | RoomOverlaySwitchPayload) => void
  'pov-online:status': (payload: RoomStatus) => void
  'pov-online:joined': (payload: RoomJoinedPayload) => void
  'pov-online:join:error': (payload: RoomJoinErrorPayload) => void
  'pov-online:peer:joined': (payload: RoomPeerJoinedPayload) => void
  'pov-online:peer:left': (payload: RoomPeerLeftPayload) => void
}

/** Events clients send to the server on the /room namespace */
export interface RoomClientToServerEvents {
  'pov-online:join': (
    payload: RoomJoinPayload,
    ack: (response: { ok: boolean; participantId?: string; error?: string }) => void
  ) => void
  'pov-online:audio-level': (payload: RoomAudioLevelPayload) => void
  'pov-online:signal': (payload: SignalingMessage) => void
  'pov-online:room:create': (
    ack: (response: { ok: boolean; roomCode?: string; joinUrl?: string; error?: string }) => void
  ) => void
  'pov-online:room:close': (payload: RoomClosePayload) => void
  'pov-online:room:rejoin': (
    payload: { roomCode: string },
    ack: (response: { ok: boolean; error?: string }) => void
  ) => void
  'pov-online:mode:set': (payload: RoomModeSetPayload) => void
  'pov-online:select': (
    payload: RoomSelectPayload,
    ack: (response: { ok: boolean; error?: string }) => void
  ) => void
  'pov-online:kick': (
    payload: { roomCode: string; participantId: string },
    ack: (response: { ok: boolean; error?: string }) => void
  ) => void
  'pov-online:overlay:subscribe': (payload: RoomOverlaySubscribePayload) => void
  'pov-online:preview:answer': (payload: RoomPreviewAnswerPayload) => void
  'pov-online:preview:ice': (payload: RoomPreviewIcePayload) => void
}

/** Inter-server events for the /room namespace */
export interface RoomInterServerEvents {}

/** Socket data for the /room namespace */
export interface RoomSocketData {
  userId?: string
  participantId?: string
  roomCode?: string
  role?: 'player' | 'admin' | 'overlay'
}

// ── Backward-compat aliases ───────────────────────────────────────

/** @deprecated Use RoomCreatedPayload */
export type OnlineRoomCreatedPayload = RoomCreatedPayload
/** @deprecated Use RoomClosedPayload */
export type OnlineRoomClosedPayload = RoomClosedPayload
/** @deprecated Use RoomIdlePayload */
export type OnlineRoomIdlePayload = RoomIdlePayload
/** @deprecated Use RoomParticipantJoinedPayload */
export type OnlineParticipantJoinedPayload = RoomParticipantJoinedPayload
/** @deprecated Use RoomParticipantLeftPayload */
export type OnlineParticipantLeftPayload = RoomParticipantLeftPayload
/** @deprecated Use RoomScoresPayload */
export type OnlineScoresPayload = RoomScoresPayload
/** @deprecated Use RoomSwitchPayload */
export type OnlineSwitchPayload = RoomSwitchPayload
/** @deprecated Use RoomJoinedPayload */
export type OnlineJoinedPayload = RoomJoinedPayload
/** @deprecated Use RoomJoinErrorPayload */
export type OnlineJoinErrorPayload = RoomJoinErrorPayload
/** @deprecated Use RoomPeerJoinedPayload */
export type OnlinePeerJoinedPayload = RoomPeerJoinedPayload
/** @deprecated Use RoomPeerLeftPayload */
export type OnlinePeerLeftPayload = RoomPeerLeftPayload
/** @deprecated Use RoomOverlaySwitchPayload */
export type OnlineOverlaySwitchPayload = RoomOverlaySwitchPayload
/** @deprecated Use RoomJoinPayload */
export type OnlineJoinPayload = RoomJoinPayload
/** @deprecated Use RoomAudioLevelPayload */
export type OnlineAudioLevelPayload = RoomAudioLevelPayload
/** @deprecated Use RoomClosePayload */
export type OnlineRoomClosePayload = RoomClosePayload
/** @deprecated Use RoomModeSetPayload */
export type OnlineModeSetPayload = RoomModeSetPayload
/** @deprecated Use RoomSelectPayload */
export type OnlineSelectPayload = RoomSelectPayload
/** @deprecated Use RoomOverlaySubscribePayload */
export type OnlineOverlaySubscribePayload = RoomOverlaySubscribePayload
/** @deprecated Use RoomPreviewStreamInfo */
export type AdminStreamInfo = RoomPreviewStreamInfo
/** @deprecated Use RoomPreviewOfferPayload */
export type AdminStreamOfferPayload = RoomPreviewOfferPayload
/** @deprecated Use RoomPreviewAnswerPayload */
export type AdminStreamAnswerPayload = RoomPreviewAnswerPayload
/** @deprecated Use RoomPreviewIcePayload */
export type AdminStreamIceCandidatePayload = RoomPreviewIcePayload
/** @deprecated Use RoomPreviewRemovedPayload */
export type AdminStreamRemovedPayload = RoomPreviewRemovedPayload
/** @deprecated Use RoomServerToAdminEvents */
export type OnlineServerToAdminEvents = RoomServerToAdminEvents
/** @deprecated Use RoomServerToPlayerEvents */
export type OnlineServerToPlayerEvents = RoomServerToPlayerEvents
/** @deprecated Use RoomServerToOverlayEvents */
export type OnlineServerToOverlayEvents = RoomServerToOverlayEvents
/** @deprecated Use RoomServerToClientEvents */
export type OnlineServerToClientEvents = RoomServerToClientEvents
/** @deprecated Use RoomClientToServerEvents */
export type OnlineClientToServerEvents = RoomClientToServerEvents
/** @deprecated Use RoomInterServerEvents */
export type OnlineInterServerEvents = RoomInterServerEvents
/** @deprecated Use RoomSocketData */
export type OnlineSocketData = RoomSocketData
