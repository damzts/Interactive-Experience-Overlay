/**
 * LAN /join namespace — local WebRTC signaling without cloud dependency.
 *
 * Guests on the same network open http://<host-ip>:3000/join in a browser,
 * grant camera/mic, and connect directly to the WebRTC hub via this namespace.
 *
 * Security:
 * - Room code (6-char): host displays in admin, guest must provide.
 * - Rate limit: max 10 connection attempts per IP per minute.
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

// ── Room code ─────────────────────────────────────────────────────

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// Exported so the admin can display and regenerate the code
export let CURRENT_ROOM_CODE: string = generateRoomCode()

export function regenerateRoomCode(): string {
  CURRENT_ROOM_CODE = generateRoomCode()
  logger.info(`[join] Room code regenerated: ${CURRENT_ROOM_CODE}`)
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

// Periodically clean stale buckets to avoid memory growth
setInterval(() => {
  const now = Date.now()
  for (const [ip, bucket] of rateBuckets) {
    if (now - bucket.windowStart > RATE_WINDOW_MS) rateBuckets.delete(ip)
  }
}, RATE_WINDOW_MS)

// ─────────────────────────────────────────────────────────────────

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
    const ip = (socket.handshake.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim()
      || socket.handshake.address

    // Rate limit
    if (!checkRateLimit(ip)) {
      logger.warn(`[join] Rate limit exceeded for ${ip}`)
      socket.emit('error', { message: 'Too many connection attempts. Try again in a minute.' })
      socket.disconnect(true)
      return
    }

    // Room code auth (skip if JOIN_CODE env is 'disabled')
    const joinCodeEnabled = process.env['JOIN_CODE_DISABLED'] !== 'true'
    if (joinCodeEnabled) {
      const providedCode = (socket.handshake.auth as { roomCode?: string })?.roomCode?.trim().toUpperCase()
      if (!providedCode || providedCode !== CURRENT_ROOM_CODE) {
        logger.warn(`[join] Invalid room code from ${ip}: '${providedCode}'`)
        socket.emit('error', { message: 'Invalid room code.' })
        socket.disconnect(true)
        return
      }
    }

    const userId = participantId(socket.id)
    const displayName = (socket.handshake.auth as { displayName?: string })?.displayName || `LAN Guest (${socket.id.slice(0, 6)})`
    let addedToPov = false
    let pendingAnswer = false
    let buffered: any[] = []

    participantSockets.set(userId, socket)
    logger.info(`[join] LAN participant connected: ${userId} (${socket.id})`)

    hubConnection.onIceCandidate((id, candidate) => {
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
        const answerSdp = await hubConnection.handleOffer(userId, sdp)
        socket.emit('answer', answerSdp)
        pendingAnswer = false

        for (const c of buffered) socket.emit('ice-candidate', c)
        buffered = []

        if (!addedToPov) {
          povOrchestrator.addParticipant(userId, displayName)
          addedToPov = true
          logger.info(`[join] ${userId} (${displayName}) added to POV pipeline`)

          if (onlineManager) {
            const rooms = onlineManager.getRooms()
            if (rooms.length > 0) {
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
