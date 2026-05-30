/**
 * SignalingServer — relays WebRTC signaling messages between peers.
 * Does not inspect or modify media content (SDP offers/answers, ICE candidates).
 *
 * Uses a delegate/callback pattern for sending messages to sockets.
 * The actual Socket.IO integration is wired in the online namespace handler (task 8.1).
 *
 * Requirements: 4.1, 4.2, 4.3, 4.7
 */

import type { SignalingMessage } from '@ieom/shared'
import type { OnlineRoom } from './session-manager.js'

// ── Types ────────────────────────────────────────────────────────

/** Callback to send a signaling message to a specific socket */
export type SendToSocketFn = (socketId: string, event: string, payload: unknown) => void

/** Callback to retrieve a room by code */
export type GetRoomFn = (roomCode: string) => OnlineRoom | undefined

/** Logger interface for warning messages */
export interface SignalingLogger {
  warn(message: string, ...args: unknown[]): void
}

/** Overlay subscription: maps roomCode → socketId of the subscribed overlay */
export type GetOverlaySocketFn = (roomCode: string) => string | undefined

// ── Interface ────────────────────────────────────────────────────

export interface ISignalingServer {
  /** Handle incoming signaling message and relay to target */
  relay(message: SignalingMessage): void

  /** Notify all participants in a room about a new peer */
  notifyNewPeer(roomCode: string, participantId: string, displayName: string): void

  /** Notify all participants about a peer disconnection */
  notifyPeerDisconnect(roomCode: string, participantId: string): void
}

// ── Dependencies ─────────────────────────────────────────────────

export interface SignalingServerDeps {
  getRoom: GetRoomFn
  sendToSocket: SendToSocketFn
  getOverlaySocket: GetOverlaySocketFn
  logger?: SignalingLogger
}

// ── Default Logger ───────────────────────────────────────────────

const defaultLogger: SignalingLogger = {
  warn(message: string, ...args: unknown[]) {
    console.warn(`[SignalingServer] ${message}`, ...args)
  },
}

// ── Implementation ───────────────────────────────────────────────

export class SignalingServer implements ISignalingServer {
  private readonly getRoom: GetRoomFn
  private readonly sendToSocket: SendToSocketFn
  private readonly getOverlaySocket: GetOverlaySocketFn
  private readonly logger: SignalingLogger

  constructor(deps: SignalingServerDeps) {
    this.getRoom = deps.getRoom
    this.sendToSocket = deps.sendToSocket
    this.getOverlaySocket = deps.getOverlaySocket
    this.logger = deps.logger ?? defaultLogger
  }

  /**
   * Relay a signaling message to the target peer.
   *
   * Validates:
   * - The room exists
   * - The sender is a participant in the room OR is 'overlay'
   * - The target is a participant in the room OR is 'overlay'
   *
   * Drops messages to unknown targets silently with a warning log.
   * Does not inspect or modify the payload (Req 4.2).
   */
  relay(message: SignalingMessage): void {
    const { roomCode, from, to } = message

    // Validate room exists
    const room = this.getRoom(roomCode)
    if (!room) {
      this.logger.warn('relay: room not found', { roomCode, from, to })
      return
    }

    // Validate sender is a participant in the room or 'overlay'
    if (from !== 'overlay') {
      const sender = room.participants.get(from)
      if (!sender || sender.connectionStatus !== 'connected') {
        this.logger.warn('relay: sender not authenticated in room', { roomCode, from, to })
        return
      }
    } else {
      // Validate overlay is subscribed to this room
      const overlaySocket = this.getOverlaySocket(roomCode)
      if (!overlaySocket) {
        this.logger.warn('relay: overlay sender not subscribed to room', { roomCode, from, to })
        return
      }
    }

    // Resolve target socket ID
    const targetSocketId = this.resolveTargetSocket(room, roomCode, to)
    if (!targetSocketId) {
      // Drop silently with warning (Req: drop messages to unknown targets)
      this.logger.warn('relay: unknown target, dropping message', { roomCode, from, to })
      return
    }

    // Forward message unchanged to target (Req 4.2)
    this.sendToSocket(targetSocketId, 'pov-online:signal', message)
  }

  /**
   * Notify all existing participants in a room about a new peer.
   * Also notifies the overlay if subscribed (Req 4.3).
   */
  notifyNewPeer(roomCode: string, participantId: string, displayName: string): void {
    const room = this.getRoom(roomCode)
    if (!room) return

    const payload = { participantId, displayName }

    // Notify all existing participants except the new one
    for (const participant of room.participants.values()) {
      if (participant.id === participantId) continue
      if (participant.connectionStatus !== 'connected') continue

      this.sendToSocket(participant.socketId, 'pov-online:peer:joined', payload)
    }

    // Notify overlay if subscribed
    const overlaySocketId = this.getOverlaySocket(roomCode)
    if (overlaySocketId) {
      this.sendToSocket(overlaySocketId, 'pov-online:peer:joined', payload)
    }
  }

  /**
   * Notify all remaining participants about a peer disconnection.
   * Also notifies the overlay if subscribed (Req 4.7).
   */
  notifyPeerDisconnect(roomCode: string, participantId: string): void {
    const room = this.getRoom(roomCode)
    if (!room) return

    const payload = { participantId }

    // Notify all remaining connected participants
    for (const participant of room.participants.values()) {
      if (participant.id === participantId) continue
      if (participant.connectionStatus !== 'connected') continue

      this.sendToSocket(participant.socketId, 'pov-online:peer:left', payload)
    }

    // Notify overlay if subscribed
    const overlaySocketId = this.getOverlaySocket(roomCode)
    if (overlaySocketId) {
      this.sendToSocket(overlaySocketId, 'pov-online:peer:left', payload)
    }
  }

  // ── Private Helpers ──────────────────────────────────────────

  /**
   * Resolve the target's socket ID.
   * Returns undefined if the target is not found (unknown target).
   */
  private resolveTargetSocket(
    room: OnlineRoom,
    roomCode: string,
    targetId: string,
  ): string | undefined {
    if (targetId === 'overlay') {
      return this.getOverlaySocket(roomCode)
    }

    const target = room.participants.get(targetId)
    if (!target || target.connectionStatus !== 'connected') {
      return undefined
    }

    return target.socketId
  }
}
