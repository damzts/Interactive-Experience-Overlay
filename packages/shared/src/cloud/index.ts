/**
 * Shared cloud types — contracts between ieom-api (Fastify backend)
 * and the monorepo (desktop app, overlay, admin).
 *
 * These types live in the monorepo so that both the cloud API and
 * the desktop app can consume them from a single source of truth.
 */

// ── Auth ──────────────────────────────────────────────────────────

/** JWT token payload claims */
export interface JwtPayload {
  userId: string
  email: string
}

// ── Rooms (WebRTC signaling) ──────────────────────────────────────

/** WebSocket message format used in /ws/rooms/:roomId signaling */
export interface WsMessage {
  type: string
  payload: Record<string, unknown>
  senderId: string
  timestamp: string
  /** Optional: route this message only to a specific user */
  targetUserId?: string
}

/** Request body for POST /rooms */
export interface CreateRoomBody {
  name?: string
}

/** Participant in a live room (server-side) */
export interface RoomParticipant {
  userId: string
  displayName: string
  role: 'hub' | 'participant'
  joinedAt: string
  ws: unknown // WebSocket reference, not serialized
}

/** Live room state (server-side) */
export interface LiveRoom {
  roomCode: string
  name: string
  participants: Map<string, RoomParticipant>
  createdAt: string
  hubId: string | null
}

// ── License / Billing ─────────────────────────────────────────────

/** Response shape for GET /user/license */
export interface LicenseResponse {
  planName: 'Free' | 'Pro' | 'Pro+Rooms'
  status: 'active' | 'canceled' | 'past_due' | 'trialing'
}

/** Request body for POST /checkout/session */
export interface CheckoutBody {
  plan: 'pro' | 'pro_rooms'
}

// ── Updates ───────────────────────────────────────────────────────

/** Response shape for GET /api/updates/manifest */
export interface UpdateManifest {
  version: string
  download_url: string
  release_notes: string
}

// ── Room response shapes (used by frontend) ────────────────────

/** Room data as returned to the frontend */
export interface Room {
  id: string
  name: string
  createdAt: string
  participantCount?: number
  hubConnected?: boolean
}

/** Checkout session response */
export interface CheckoutSessionResponse {
  url: string
}

/** Portal session response */
export interface PortalSessionResponse {
  url: string
}

/** Room creation response */
export interface CreateRoomResponse {
  room: Room
}

/** Info about a participant in the room, sent via WS */
export interface ParticipantInfo {
  userId: string
  userEmail: string
}

// ── WebRTC signaling (used by both server and frontend) ───────────

/** Alias: same shape as WsMessage but relaxed payload for frontend use */
export interface SignalingMessage {
  type: string
  payload: unknown
  senderId?: string
  timestamp?: string
  targetUserId?: string
}

/** SDP data for WebRTC offer/answer */
export interface SdpPayload {
  sdp: string
  type: 'offer' | 'answer'
}

/** ICE candidate data for WebRTC */
export interface IceCandidatePayload {
  candidate: string
  sdpMid: string | null
  sdpMLineIndex: number | null
}

// ── Common ────────────────────────────────────────────────────────

/** Standard error response shape */
export interface ErrorResponse {
  error: string
  statusCode: number
}
