/**
 * /rooms Socket.IO namespace — pure signaling relay.
 * Routes WebRTC offers/answers/ICE candidates between hub and participants.
 * No media touches the server.
 */

import type { Server, Socket } from 'socket.io'
import type { RoomManager } from '../online/session-manager.js'

export function registerRoomsNamespace(io: Server, roomManager: RoomManager): void {
  const nsp = io.of('/rooms')

  nsp.on('connection', (socket: Socket) => {
    const auth = socket.handshake.auth as { token?: string; roomId?: string; role?: string }
    const roomId = auth.roomId as string | undefined

    socket.on('join-as-hub', (payload: { roomId: string }) => {
      const rid = payload.roomId || roomId
      if (!rid) return
      const ok = roomManager.setHub(rid, socket.id)
      if (!ok) { socket.emit('error', { message: 'room_not_found' }); return }
      socket.data.role = 'hub'
      socket.data.roomId = rid
      socket.join(`room:${rid}`)

      // Send existing participants to the hub
      const room = roomManager.getRoom(rid)
      if (room) {
        const participants = [...room.participants.values()].map(p => ({ userId: p.userId, displayName: p.displayName }))
        socket.emit('participants-list', { participants })
      }
    })

    socket.on('join-as-participant', (payload: { roomId: string; displayName: string; userId: string }) => {
      const rid = payload.roomId || roomId
      if (!rid || !payload.displayName || !payload.userId) return
      const result = roomManager.addParticipant(rid, payload.userId, payload.displayName, socket.id)
      if (!result.ok) { socket.emit('error', { message: result.error }); return }
      socket.data.role = 'participant'
      socket.data.roomId = rid
      socket.data.userId = payload.userId
      socket.join(`room:${rid}`)

      // Notify hub about new participant
      const room = roomManager.getRoom(rid)
      if (room?.hubSocketId) {
        const hubSocket = nsp.sockets.get(room.hubSocketId)
        hubSocket?.emit('participant-joined', { userId: payload.userId, displayName: payload.displayName })
      }

      // Tell participant if hub is available
      if (room?.hubSocketId) {
        socket.emit('hub-info', { ready: true })
      }
    })

    // WebRTC signaling: offer from participant → hub
    socket.on('offer', (payload: { sdp: string; userId?: string }) => {
      const rid = socket.data.roomId as string
      if (!rid) return
      const room = roomManager.getRoom(rid)
      if (!room) return

      if (socket.data.role === 'participant') {
        // Participant sending offer to hub
        if (room.hubSocketId) {
          const hubSocket = nsp.sockets.get(room.hubSocketId)
          hubSocket?.emit('offer', { sdp: payload.sdp, userId: socket.data.userId })
        }
      }
    })

    // WebRTC signaling: answer from hub → participant
    socket.on('answer', (payload: { sdp: string; userId: string }) => {
      if (socket.data.role !== 'hub') return
      const rid = socket.data.roomId as string
      if (!rid) return
      const room = roomManager.getRoom(rid)
      if (!room) return

      const participant = room.participants.get(payload.userId)
      if (participant) {
        const pSocket = nsp.sockets.get(participant.socketId)
        pSocket?.emit('answer', { sdp: payload.sdp })
      }
    })

    // ICE candidates — bidirectional relay
    socket.on('ice-candidate', (payload: { candidate: string; sdpMid?: string; sdpMLineIndex?: number; userId: string }) => {
      const rid = socket.data.roomId as string
      if (!rid) return
      const room = roomManager.getRoom(rid)
      if (!room) return

      if (socket.data.role === 'hub') {
        // Hub sending ICE to a specific participant
        const participant = room.participants.get(payload.userId)
        if (participant) {
          const pSocket = nsp.sockets.get(participant.socketId)
          pSocket?.emit('ice-candidate', { candidate: payload.candidate, sdpMid: payload.sdpMid, sdpMLineIndex: payload.sdpMLineIndex })
        }
      } else if (socket.data.role === 'participant') {
        // Participant sending ICE to hub
        if (room.hubSocketId) {
          const hubSocket = nsp.sockets.get(room.hubSocketId)
          hubSocket?.emit('ice-candidate', { candidate: payload.candidate, sdpMid: payload.sdpMid, sdpMLineIndex: payload.sdpMLineIndex, userId: socket.data.userId })
        }
      }
    })

    socket.on('disconnect', () => {
      const rid = socket.data.roomId as string
      if (!rid) return

      if (socket.data.role === 'hub') {
        roomManager.removeHub(rid)
        // Notify all participants that hub disconnected
        nsp.to(`room:${rid}`).emit('hub-disconnected')
      } else if (socket.data.role === 'participant') {
        const userId = socket.data.userId as string
        if (userId) {
          roomManager.removeParticipant(rid, userId)
          // Notify hub
          const room = roomManager.getRoom(rid)
          if (room?.hubSocketId) {
            const hubSocket = nsp.sockets.get(room.hubSocketId)
            hubSocket?.emit('participant-left', { userId })
          }
        }
      }
    })
  })
}
