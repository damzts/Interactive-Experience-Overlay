/**
 * /room Socket.IO namespace — handles admin events for room management
 * and broadcasts room status updates.
 */

import type { Server as SocketIOServer } from 'socket.io'
import logger from '../lib/logger.js'
import type { RoomManager } from './manager.js'
import type { RoomPreviewRelay } from '../transport/webrtc/room-preview-relay.js'
import { verifyAccessToken } from '../auth/jwt.js'
import type {
  RoomClientToServerEvents,
  RoomServerToClientEvents,
  RoomInterServerEvents,
  RoomSocketData,
  RoomClosePayload,
  RoomModeSetPayload,
  RoomSelectPayload,
} from '@ieomlabs/shared'

type RoomNamespace = ReturnType<
  SocketIOServer<RoomClientToServerEvents, RoomServerToClientEvents, RoomInterServerEvents, RoomSocketData>['of']
>

/**
 * Validates the admin token or JWT Bearer token on socket handshake.
 * Only admin roles are checked — player/overlay roles pass through.
 *
 * If OVERLAY_ADMIN_TOKEN is NOT configured → allow all (unprotected dev mode).
 * If OVERLAY_ADMIN_TOKEN IS configured → require the correct token or a valid JWT.
 */
function validateAdminToken(auth: Record<string, unknown>): boolean {
  const role = (auth?.clientType as string) ?? 'player'
  if (role !== 'admin') return true

  const adminToken = process.env['OVERLAY_ADMIN_TOKEN']?.trim()
  if (!adminToken) return true

  const token = (auth?.token as string)?.trim()
  if (!token) return false

  if (token === adminToken) return true

  try {
    verifyAccessToken(token)
    return true
  } catch {
    return false
  }
}

export function registerRoomNamespace(
  io: SocketIOServer,
  manager: RoomManager,
  previewRelay?: RoomPreviewRelay,
): void {
  const nsp: RoomNamespace = io.of('/room') as unknown as RoomNamespace
  logger.info('[room] /room namespace registered')

  manager.onEvent((event, payload) => {
    nsp.emit(event as keyof RoomServerToClientEvents, payload as any)
  })

  nsp.use((socket, next) => {
    const auth = socket.handshake.auth as Record<string, unknown>
    if (!validateAdminToken(auth)) {
      logger.warn(`[room] Rejected admin connection from ${socket.id}: invalid token`)
      return next(new Error('unauthorized'))
    }
    next()
  })

  nsp.on('connection', (socket) => {
    const role = (socket.handshake.auth as { clientType?: string })?.clientType ?? 'player'
    socket.data.role = role as 'admin' | 'player' | 'overlay'
    logger.info(`[room] ${role} connected: ${socket.id}`)

    // ── Admin events ─────────────────────────────────────────────

    socket.on('pov-online:room:create', (ack) => {
      manager.createRoom().then((result) => {
        if (result.ok) {
          ack({ ok: true, roomCode: result.roomCode, joinUrl: result.roomCode })
        } else {
          ack({ ok: false, error: result.error })
        }
      }).catch((e: Error) => {
        ack({ ok: false, error: e.message })
      })
    })

    socket.on('pov-online:room:close', (payload: RoomClosePayload) => {
      manager.closeRoom(payload.roomCode).catch((e) =>
        logger.warn({ err: e?.message ?? e, roomCode: payload.roomCode }, '[namespace] closeRoom failed')
      )
    })

    socket.on('pov-online:room:rejoin', (payload: { roomCode: string }, ack: (response: { ok: boolean; error?: string }) => void) => {
      manager.rejoinRoom(payload.roomCode).then((result) => {
        ack(result)
      }).catch((e: Error) => {
        ack({ ok: false, error: e.message })
      })
    })

    socket.on('pov-online:mode:set', (payload: RoomModeSetPayload) => {
      manager.setMode(payload.roomCode, payload.mode)
    })

    socket.on('pov-online:select', (payload: RoomSelectPayload, ack) => {
      const result = manager.selectParticipant(payload.roomCode, payload.participantId)
      ack(result)
    })

    socket.on('pov-online:kick', (payload: { roomCode: string; participantId: string }, ack: (response: { ok: boolean; error?: string }) => void) => {
      const room = manager.getRoom(payload.roomCode)
      if (!room) { ack({ ok: false, error: 'room_not_found' }); return }
      manager.removeParticipant(payload.roomCode, payload.participantId)
      manager.emitKick(payload.roomCode, payload.participantId)
      ack({ ok: true })
    })

    // ── Player events ────────────────────────────────────────────

    socket.on('pov-online:audio-level', (_payload) => {
      const participantId = socket.data.participantId
      if (!participantId) return
      const _roomCode = socket.data.roomCode
    })

    socket.on('pov-online:join', (payload, ack) => {
      const { roomCode, displayName } = payload
      const room = manager.getRoom(roomCode)
      if (!room) {
        ack({ ok: false, error: 'room_not_found' })
        return
      }
      const participantId = socket.id
      socket.data.participantId = participantId
      socket.data.roomCode = roomCode
      socket.data.role = 'player'
      manager.addParticipant(roomCode, participantId, displayName)
      socket.join(`room:${roomCode}`)
      ack({ ok: true, participantId })
    })

    // ── Admin WebRTC preview relay ────────────────────────────

    if (role === 'admin' && previewRelay) {
      previewRelay.setSocket(socket as any)

      ;(socket as any).on('pov-online:preview:answer', (payload: { userId: string; sdp: string }) => {
        previewRelay!.handleAnswer(payload.userId, payload.sdp).catch((e) =>
          logger.error({ err: e }, '[room-preview-relay] answer error'),
        )
      })

      ;(socket as any).on('pov-online:preview:ice', (payload: { userId: string; candidate: unknown }) => {
        previewRelay!.handleIceCandidate(payload.userId, payload.candidate as any).catch((e) =>
          logger.error({ err: e }, '[room-preview-relay] ice-candidate error'),
        )
      })
    }

    socket.on('disconnect', () => {
      const { roomCode, participantId } = socket.data
      if (roomCode && participantId) {
        manager.removeParticipant(roomCode, participantId)
      }
      if (role === 'admin' && previewRelay) {
        previewRelay.clearSocket(socket.id)
      }
    })
  })
}

/** @deprecated Use registerRoomNamespace */
export { registerRoomNamespace as registerOnlineNamespace }
