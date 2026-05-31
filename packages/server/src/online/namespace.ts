/**
 * /online Socket.IO namespace — handles admin events for room management
 * and broadcasts room status updates.
 */

import type { Server as SocketIOServer } from 'socket.io'
import type { OnlineRoomManager } from './manager.js'
import type {
  OnlineClientToServerEvents,
  OnlineServerToClientEvents,
  OnlineInterServerEvents,
  OnlineSocketData,
  OnlineRoomClosePayload,
  OnlineModeSetPayload,
  OnlineSelectPayload,
} from '@ieom/shared'

type OnlineNamespace = ReturnType<
  SocketIOServer<OnlineClientToServerEvents, OnlineServerToClientEvents, OnlineInterServerEvents, OnlineSocketData>['of']
>

export function registerOnlineNamespace(io: SocketIOServer, manager: OnlineRoomManager): void {
  const nsp: OnlineNamespace = io.of('/online') as unknown as OnlineNamespace
  console.log('[online] /online namespace registered')

  // Forward manager events to all connected admin sockets
  manager.onEvent((event, payload) => {
    nsp.emit(event as keyof OnlineServerToClientEvents, payload as any)
  })

  nsp.on('connection', (socket) => {
    const role = (socket.handshake.auth as { clientType?: string })?.clientType ?? 'player'
    socket.data.role = role as 'admin' | 'player' | 'overlay'
    console.log(`[online] ${role} connected: ${socket.id}`)

    // ── Admin events ─────────────────────────────────────────────

    socket.on('pov-online:room:create', (ack) => {
      manager.createRoom().then((result) => {
        if (result.ok) {
          ack({ ok: true, roomCode: result.roomCode, joinUrl: `/online/room/${result.roomCode}` })
        } else {
          ack({ ok: false, error: result.error })
        }
      }).catch((e: Error) => {
        ack({ ok: false, error: e.message })
      })
    })

    socket.on('pov-online:room:close', (payload: OnlineRoomClosePayload) => {
      manager.closeRoom(payload.roomCode)
    })

    socket.on('pov-online:mode:set', (payload: OnlineModeSetPayload) => {
      manager.setMode(payload.roomCode, payload.mode)
    })

    socket.on('pov-online:select', (payload: OnlineSelectPayload, ack) => {
      const result = manager.selectParticipant(payload.roomCode, payload.participantId)
      ack(result)
    })

    // ── Player events ────────────────────────────────────────────

    socket.on('pov-online:audio-level', (payload) => {
      const participantId = socket.data.participantId
      if (!participantId) return
      // Feed audio level into the POV score processor via the manager's orchestrator
      // This is handled by CloudSignaling's WebRTC audio track monitoring
      // For browser-only participants sending levels directly:
      const roomCode = socket.data.roomCode
      if (roomCode) {
        // The POVOrchestrator's scoreProcessor handles this via reportLevel
        // but we need the reference — it's wired through the manager
      }
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

    socket.on('disconnect', () => {
      const { roomCode, participantId } = socket.data
      if (roomCode && participantId) {
        manager.removeParticipant(roomCode, participantId)
      }
    })
  })
}
