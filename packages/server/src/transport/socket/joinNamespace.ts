/**
 * LAN /join namespace — local WebRTC signaling without cloud dependency.
 *
 * Guests on the same network open http://<host-ip>:3000/join in a browser,
 * grant camera/mic, and connect directly to the WebRTC hub via this namespace.
 *
 * No auth, no room codes, no STUN/TURN needed (host candidates work on LAN).
 * Guest video/audio enters the same POV pipeline as cloud participants.
 *
 * See FEATURES.md §LAN WebRTC via /join for the design spec.
 */

import type { Server, Socket } from 'socket.io'
import type { RTCIceCandidateInit } from 'werift'
import type { HubConnection } from '../webrtc/hub-connection.js'
import type { POVOrchestrator } from '../../kernel/managers/pov.js'
import type { OnlineRoomManager } from '../../online/manager.js'
import logger from '../../lib/logger.js'

/** Unique participant ID derived from the socket ID. */
function participantId(socketId: string): string {
  return `lan-${socketId.slice(0, 8)}`
}

export function registerJoinNamespace(
  io: Server,
  hubConnection: HubConnection,
  povOrchestrator: POVOrchestrator,
  onlineManager?: OnlineRoomManager,
): void {
  const nsp = io.of('/join')
  /** Map userId → socket for kick support */
  const participantSockets = new Map<string, Socket>()

  // Allow external code to kick a LAN participant by userId
  if (onlineManager) {
    onlineManager.onEvent((event, payload) => {
      if (event === 'pov-online:participant:kicked') {
        const { participantId: kickedId } = payload as { participantId: string }
        const sock = participantSockets.get(kickedId)
        if (sock) {
          sock.emit('kicked', { reason: 'You have been removed from the room by the host.' })
          setTimeout(() => sock.disconnect(true), 500)
        }
      }
    })
  }

  nsp.on('connection', (socket: Socket) => {
    const userId = participantId(socket.id)
    const displayName = (socket.handshake.auth as { displayName?: string })?.displayName || `LAN Guest (${socket.id.slice(0, 6)})`
    let addedToPov = false
    // Track pending ICE candidates for the current offer cycle
    let pendingAnswer = false
    let buffered: any[] = []

    participantSockets.set(userId, socket)
    logger.info(`[join] LAN participant connected: ${userId} (${socket.id})`)

    // Register per-participant ICE candidate listener once
    hubConnection.onIceCandidate((id, candidate) => {
      if (id !== userId) return
      if (pendingAnswer) {
        buffered.push(candidate)
      } else {
        socket.emit('ice-candidate', candidate)
      }
    })

    // Guest sends their SDP offer
    socket.on('offer', async (sdp: string) => {
      pendingAnswer = true
      buffered = []

      try {
        const answerSdp = await hubConnection.handleOffer(userId, sdp)

        socket.emit('answer', answerSdp)
        pendingAnswer = false

        // Flush buffered candidates that arrived before answer was sent
        for (const c of buffered) socket.emit('ice-candidate', c)
        buffered = []

        // Register with POV pipeline (idempotent — ignore if already added)
        if (!addedToPov) {
          povOrchestrator.addParticipant(userId, displayName)
          addedToPov = true
          logger.info(`[join] ${userId} (${displayName}) added to POV pipeline`)

          // Also register with OnlineRoomManager so admin panel sees this participant
          if (onlineManager) {
            const rooms = onlineManager.getRooms()
            if (rooms.length > 0) {
              // Add to the first active room (LAN participants don't specify a room)
              onlineManager.addParticipant(rooms[0].roomCode, userId, displayName)
            }
          }
        }
      } catch (err: any) {
        pendingAnswer = false
        buffered = []
        logger.error(`[join] offer handling failed for ${userId}:`, err.message)
        socket.emit('error', { message: 'Offer processing failed' })
      }
    })

    // Guest ICE candidates → hub
    socket.on('ice-candidate', async (candidate: RTCIceCandidateInit) => {
      try {
        await hubConnection.handleIceCandidate(userId, candidate)
      } catch {
        // ICE candidate timing issues are normal — silently drop
      }
    })

    socket.on('disconnect', () => {
      logger.info(`[join] LAN participant disconnected: ${userId}`)
      participantSockets.delete(userId)
      void hubConnection.removeParticipant(userId)
      if (addedToPov) {
        povOrchestrator.removeParticipant(userId)
        // Also remove from OnlineRoomManager
        if (onlineManager) {
          const rooms = onlineManager.getRooms()
          for (const room of rooms) {
            onlineManager.removeParticipant(room.roomCode, userId)
          }
        }
      }
    })
  })
}

