/**
 * LAN /studio namespace — local WebRTC signaling without cloud dependency.
 *
 * Guests on the same network open http://<host-ip>:3000/studio in a browser,
 * grant camera/mic, and connect directly to the WebRTC hub via this namespace.
 *
 * Security:
 * - Room code (6-char): host displays in admin, guest must provide.
 * - Rate limit: max 10 connection attempts per IP per minute.
 *
 * See FEATURES.md §LAN WebRTC via /studio for the design spec.
 */

import type { Server, Socket } from 'socket.io'
import type { RTCIceCandidateInit } from 'werift'
import type { RoomHub } from '../webrtc/room-hub.js'
import type { POVOrchestrator } from '../../kernel/managers/pov.js'
import type { RoomManager } from '../../room/manager.js'
import logger from '../../lib/logger.js'

/** Unique participant ID derived from the socket ID. */
function participantId(socketId: string): string {
  return `studio-${socketId.slice(0, 8)}`
}

// ── Room code ─────────────────────────────────────────────────────

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// Exported so the admin can display and regenerate the code
export let CURRENT_ROOM_CODE: string = generateRoomCode()

export function regenerateRoomCode(): string {
  CURRENT_ROOM_CODE = generateRoomCode()
  logger.info(`[studio] Room code regenerated: ${CURRENT_ROOM_CODE}`)
  return CURRENT_ROOM_CODE
}

// ── Rate limiter ──────────────────────────────────────────────────

const RATE_WINDOW_MS = 60_000
const RATE_MAX = 10

const rateBuckets = new Map<string, { count: number; windowStart: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const bucket = rateBuckets.get(ip)
  if (!bucket || now - bucket.windowStart > RATE_WINDOW_MS) {
    rateBuckets.set(ip, { count: 1, windowStart: now })
    return true
  }
  if (bucket.count >= RATE_MAX) return false
  bucket.count++
  return true
}

setInterval(() => {
  const now = Date.now()
  for (const [ip, bucket] of rateBuckets) {
    if (now - bucket.windowStart > RATE_WINDOW_MS) rateBuckets.delete(ip)
  }
}, RATE_WINDOW_MS)

// ─────────────────────────────────────────────────────────────────

export function registerStudioNamespace(
  io: Server,
  roomHub: RoomHub,
  povOrchestrator: POVOrchestrator,
  roomManager?: RoomManager,
): void {
  const nsp = io.of('/studio')
  /** Map userId → socket for kick support */
  const participantSockets = new Map<string, Socket>()

  if (roomManager) {
    roomManager.onEvent((event, payload) => {
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
    const ip = (socket.handshake.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim()
      || socket.handshake.address

    if (!checkRateLimit(ip)) {
      logger.warn(`[studio] Rate limit exceeded for ${ip}`)
      socket.emit('error', { message: 'Too many connection attempts. Try again in a minute.' })
      socket.disconnect(true)
      return
    }

    const joinCodeEnabled = process.env['JOIN_CODE_DISABLED'] !== 'true'
    if (joinCodeEnabled) {
      const providedCode = (socket.handshake.auth as { roomCode?: string })?.roomCode?.trim().toUpperCase()
      if (!providedCode || providedCode !== CURRENT_ROOM_CODE) {
        logger.warn(`[studio] Invalid room code from ${ip}: '${providedCode}'`)
        socket.emit('error', { message: 'Invalid room code.' })
        socket.disconnect(true)
        return
      }
    }

    const userId = participantId(socket.id)
    const displayName = (socket.handshake.auth as { displayName?: string })?.displayName || `Studio Guest (${socket.id.slice(0, 6)})`
    let addedToPov = false
    let pendingAnswer = false
    let buffered: any[] = []

    participantSockets.set(userId, socket)
    logger.info(`[studio] LAN participant connected: ${userId} (${socket.id})`)

    roomHub.onIceCandidate((id, candidate) => {
      if (id !== userId) return
      if (pendingAnswer) {
        buffered.push(candidate)
      } else {
        socket.emit('ice-candidate', candidate)
      }
    })

    socket.on('offer', async (sdp: string) => {
      pendingAnswer = true
      buffered = []

      try {
        const answerSdp = await roomHub.handleOffer(userId, sdp)
        socket.emit('answer', answerSdp)
        pendingAnswer = false

        for (const c of buffered) socket.emit('ice-candidate', c)
        buffered = []

        if (!addedToPov) {
          povOrchestrator.addParticipant(userId, displayName)
          addedToPov = true
          logger.info(`[studio] ${userId} (${displayName}) added to POV pipeline`)

          if (roomManager) {
            const rooms = roomManager.getRooms()
            if (rooms.length > 0) {
              roomManager.addParticipant(rooms[0].roomCode, userId, displayName)
            }
          }
        }
      } catch (err: any) {
        pendingAnswer = false
        buffered = []
        logger.error(`[studio] offer handling failed for ${userId}:`, err.message)
        socket.emit('error', { message: 'Offer processing failed' })
      }
    })

    socket.on('ice-candidate', async (candidate: RTCIceCandidateInit) => {
      try {
        await roomHub.handleIceCandidate(userId, candidate)
      } catch {
        // ICE candidate timing issues are normal — silently drop
      }
    })

    socket.on('disconnect', () => {
      logger.info(`[studio] LAN participant disconnected: ${userId}`)
      participantSockets.delete(userId)
      void roomHub.removeParticipant(userId)
      if (addedToPov) {
        povOrchestrator.removeParticipant(userId)
        if (roomManager) {
          const rooms = roomManager.getRooms()
          for (const room of rooms) {
            roomManager.removeParticipant(room.roomCode, userId)
          }
        }
      }
    })
  })
}

/** @deprecated Use registerStudioNamespace */
export { registerStudioNamespace as registerJoinNamespace }
