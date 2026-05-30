/**
 * Online namespace Socket.IO handler — wires the `/online` namespace
 * to the OnlineSessionManager and SignalingServer.
 *
 * Handles all client-to-server events defined in OnlineClientToServerEvents
 * and broadcasts server-to-client events to the appropriate role sockets.
 *
 * Requirements: 2.4, 3.3, 3.4, 3.5, 3.6, 4.1, 4.2, 4.7, 5.2, 5.4, 5.5,
 *              6.1, 6.2, 6.5, 7.3, 7.5, 8.2, 9.3
 */

import type { Namespace, Server, Socket } from 'socket.io'
import type {
  OnlineClientToServerEvents,
  OnlineServerToClientEvents,
  OnlineInterServerEvents,
  OnlineSocketData,
} from '@ieom/shared'
import type { OnlineSessionManager, SessionEvent } from '../online/session-manager.js'
import type { SignalingServer } from '../online/signaling.js'

// ── Types ────────────────────────────────────────────────────────

type OnlineNamespace = Namespace<
  OnlineClientToServerEvents,
  OnlineServerToClientEvents,
  OnlineInterServerEvents,
  OnlineSocketData
>

type OnlineSocket = Socket<
  OnlineClientToServerEvents,
  OnlineServerToClientEvents,
  OnlineInterServerEvents,
  OnlineSocketData
>

// ── Registration ─────────────────────────────────────────────────

/**
 * Register the `/online` Socket.IO namespace and wire all event handlers.
 *
 * @param io - The root Socket.IO server instance
 * @param sessionManager - The OnlineSessionManager instance
 * @param signalingServer - The SignalingServer instance
 */
export function registerOnlineNamespace(
  io: Server,
  sessionManager: OnlineSessionManager,
  signalingServer: SignalingServer,
): void {
  const nsp: OnlineNamespace = io.of('/online')

  // ── Tracking Maps ────────────────────────────────────────────

  /** roomCode → overlay socket ID */
  const overlaySubscriptions = new Map<string, string>()

  /** Set of admin socket IDs for broadcasting admin events */
  const adminSockets = new Set<string>()

  /** socketId → { participantId, roomCode } for disconnect cleanup */
  const socketParticipantMap = new Map<string, { participantId: string; roomCode: string }>()

  // ── Helper: getOverlaySocket (used by SignalingServer) ────────

  /**
   * Returns the overlay socket ID for a given room code.
   * This is the dependency injected into SignalingServer.
   */
  function getOverlaySocket(roomCode: string): string | undefined {
    return overlaySubscriptions.get(roomCode)
  }

  // Expose getOverlaySocket to the signaling server via its deps.
  // The SignalingServer was constructed with a getOverlaySocket callback
  // that should reference this map. If the signaling server was already
  // constructed with a placeholder, we need to wire it here.
  // Since SignalingServer uses a callback pattern, the orchestrator
  // (task 8.3) will pass this function when constructing the SignalingServer.
  // For now, we export it so the orchestrator can use it.

  // ── Helper: Broadcast to admin sockets ───────────────────────

  function emitToAdmins(event: string, payload: unknown): void {
    for (const socketId of adminSockets) {
      const socket = nsp.sockets.get(socketId)
      if (socket) {
        socket.emit(event as any, payload as any)
      }
    }
  }

  // ── Helper: Emit to a specific socket ────────────────────────

  function emitToSocket(socketId: string, event: string, payload: unknown): void {
    const socket = nsp.sockets.get(socketId)
    if (socket) {
      socket.emit(event as any, payload as any)
    }
  }

  // ── Helper: Emit to all players in a room ────────────────────

  function emitToRoomPlayers(roomCode: string, event: string, payload: unknown): void {
    const room = sessionManager.getRoom(roomCode)
    if (!room) return

    for (const participant of room.participants.values()) {
      if (participant.connectionStatus !== 'connected') continue
      const socket = nsp.sockets.get(participant.socketId)
      if (socket) {
        socket.emit(event as any, payload as any)
      }
    }
  }

  // ── Wire SessionManager Events → Socket Broadcasts ───────────

  const handleSessionEvent = (event: SessionEvent): void => {
    switch (event.type) {
      case 'room:created':
        emitToAdmins('pov-online:room:created', {
          roomCode: event.roomCode,
          joinUrl: event.joinUrl,
          createdAt: event.createdAt,
        })
        break

      case 'room:closed':
        emitToAdmins('pov-online:room:closed', { roomCode: event.roomCode })
        emitToRoomPlayers(event.roomCode, 'pov-online:room:closed', { roomCode: event.roomCode })
        break

      case 'room:idle':
        emitToAdmins('pov-online:room:idle', { roomCode: event.roomCode })
        break

      case 'participant:joined':
        emitToAdmins('pov-online:participant:joined', {
          roomCode: event.roomCode,
          participant: event.participant,
        })
        // Emit status update to admins
        emitRoomStatus(event.roomCode)
        break

      case 'participant:left':
        emitToAdmins('pov-online:participant:left', {
          roomCode: event.roomCode,
          participantId: event.participantId,
        })
        // Emit status update to admins
        emitRoomStatus(event.roomCode)
        break

      case 'scores':
        emitToAdmins('pov-online:scores', {
          roomCode: event.roomCode,
          scores: event.scores,
          timestamp: event.timestamp,
        })
        break

      case 'switch': {
        // Emit to admins with full payload
        emitToAdmins('pov-online:switch', {
          roomCode: event.roomCode,
          previousId: event.previousId,
          newId: event.newId,
          timestamp: event.timestamp,
          reason: event.reason,
        })
        // Emit to overlay with overlay-specific payload
        const overlaySocketId = overlaySubscriptions.get(event.roomCode)
        if (overlaySocketId) {
          emitToSocket(overlaySocketId, 'pov-online:switch', {
            previousId: event.previousId,
            newId: event.newId,
            timestamp: event.timestamp,
          })
        }
        break
      }

      case 'mode:changed':
        emitRoomStatus(event.roomCode)
        break

      case 'status':
        emitToAdmins('pov-online:status', event.status)
        break
    }
  }

  sessionManager.onEvent(handleSessionEvent)

  // ── Helper: Emit room status to admins ───────────────────────

  function emitRoomStatus(roomCode: string): void {
    const status = sessionManager.getRoomStatus(roomCode)
    if (status) {
      emitToAdmins('pov-online:status', status)
    }
  }

  // ── Connection Handler ───────────────────────────────────────

  nsp.on('connection', (socket: OnlineSocket) => {
    // Determine role from handshake auth
    const auth = socket.handshake.auth as { role?: string } | undefined
    const role = auth?.role as 'player' | 'admin' | 'overlay' | undefined
    socket.data.role = role

    // Track admin sockets
    if (role === 'admin') {
      adminSockets.add(socket.id)
    }

    // ── pov-online:room:create ─────────────────────────────────
    socket.on('pov-online:room:create', (ack) => {
      // Require authentication for room creation (Req 11.2)
      const userId = socket.data.userId as string | undefined
      if (!userId) {
        ack({ ok: false, error: 'authentication_required' })
        return
      }

      const result = sessionManager.createRoom(userId)

      if ('error' in result) {
        ack({ ok: false, error: result.error })
        return
      }

      ack({ ok: true, roomCode: result.roomCode, joinUrl: result.joinUrl })
    })

    // ── pov-online:room:close ──────────────────────────────────
    socket.on('pov-online:room:close', (payload) => {
      const { roomCode } = payload

      // Notify all players in the room before closing
      emitToRoomPlayers(roomCode, 'pov-online:room:closed', { roomCode })

      sessionManager.closeRoom(roomCode)

      // Clean up overlay subscription for this room
      overlaySubscriptions.delete(roomCode)

      // Clean up socket-participant mappings for this room
      for (const [socketId, mapping] of socketParticipantMap.entries()) {
        if (mapping.roomCode === roomCode) {
          socketParticipantMap.delete(socketId)
        }
      }
    })

    // ── pov-online:join ────────────────────────────────────────
    socket.on('pov-online:join', (payload, ack) => {
      const { roomCode, displayName } = payload

      // Validate inputs
      if (!roomCode || typeof roomCode !== 'string') {
        ack({ ok: false, error: 'room_not_found' })
        return
      }

      if (!displayName || typeof displayName !== 'string' || displayName.length === 0 || displayName.length > 32) {
        ack({ ok: false, error: 'invalid_name' })
        return
      }

      const result = sessionManager.joinRoom(roomCode, displayName, socket.id)

      if ('error' in result) {
        ack({ ok: false, error: result.error })
        return
      }

      // Store participant mapping for disconnect cleanup
      socket.data.participantId = result.participantId
      socket.data.roomCode = roomCode
      socket.data.role = 'player'
      socketParticipantMap.set(socket.id, {
        participantId: result.participantId,
        roomCode,
      })

      // Get current participants for the joined response
      const room = sessionManager.getRoom(roomCode)
      const participants = room
        ? Array.from(room.participants.values()).map((p) => ({
            id: p.id,
            displayName: p.displayName,
            connectionStatus: p.connectionStatus,
            activityScore: p.activityScore,
            joinedAt: p.joinedAt,
          }))
        : []

      // Ack success to the joining player
      ack({ ok: true, participantId: result.participantId })

      // Emit joined event to the player with full participant list
      socket.emit('pov-online:joined', {
        participantId: result.participantId,
        roomCode,
        participants,
      })

      // Notify signaling server about the new peer
      signalingServer.notifyNewPeer(roomCode, result.participantId, displayName)
    })

    // ── pov-online:audio-level ─────────────────────────────────
    socket.on('pov-online:audio-level', (payload) => {
      const participantId = socket.data.participantId
      const roomCode = socket.data.roomCode

      if (!participantId || !roomCode) return

      // Clamp level to [0, 1]
      const level = Math.max(0, Math.min(1, payload.level ?? 0))
      sessionManager.handleAudioReport(roomCode, participantId, level)
    })

    // ── pov-online:signal ──────────────────────────────────────
    socket.on('pov-online:signal', (payload) => {
      signalingServer.relay(payload)
    })

    // ── pov-online:mode:set ────────────────────────────────────
    socket.on('pov-online:mode:set', (payload) => {
      const { roomCode, mode } = payload
      sessionManager.setMode(roomCode, mode)
    })

    // ── pov-online:select ──────────────────────────────────────
    socket.on('pov-online:select', (payload, ack) => {
      const { roomCode, participantId } = payload
      const result = sessionManager.manualSelect(roomCode, participantId)
      ack(result)
    })

    // ── pov-online:overlay:subscribe ───────────────────────────
    socket.on('pov-online:overlay:subscribe', (payload) => {
      const { roomCode } = payload
      socket.data.role = 'overlay'
      socket.data.roomCode = roomCode
      overlaySubscriptions.set(roomCode, socket.id)
    })

    // ── disconnect ─────────────────────────────────────────────
    socket.on('disconnect', () => {
      // Clean up admin socket tracking
      adminSockets.delete(socket.id)

      // Clean up overlay subscription
      for (const [roomCode, socketId] of overlaySubscriptions.entries()) {
        if (socketId === socket.id) {
          overlaySubscriptions.delete(roomCode)
          break
        }
      }

      // Clean up player participant
      const mapping = socketParticipantMap.get(socket.id)
      if (mapping) {
        const { participantId, roomCode } = mapping
        sessionManager.leaveRoom(roomCode, participantId)
        signalingServer.notifyPeerDisconnect(roomCode, participantId)
        socketParticipantMap.delete(socket.id)
      }
    })
  })

  // Export the getOverlaySocket function for external use
  // (The orchestrator passes this to SignalingServer at construction time)
  ;(registerOnlineNamespace as any)._getOverlaySocket = getOverlaySocket
  ;(registerOnlineNamespace as any)._emitToSocket = emitToSocket
}

/**
 * Returns the getOverlaySocket function after the namespace has been registered.
 * Used by the orchestrator to wire into SignalingServer deps.
 */
export function getOverlaySocketFn(): ((roomCode: string) => string | undefined) | undefined {
  return (registerOnlineNamespace as any)._getOverlaySocket
}

/**
 * Returns the emitToSocket function after the namespace has been registered.
 * Used by the orchestrator to wire into SignalingServer deps.
 */
export function getSendToSocketFn(): ((socketId: string, event: string, payload: unknown) => void) | undefined {
  return (registerOnlineNamespace as any)._emitToSocket
}
