/**
 * REST routes for online rooms:
 *   GET  /api/config/online — get room config
 *   PATCH /api/config/online — update room config
 *   GET  /api/online/rooms — list active rooms
 */

import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import type { RoomConfig, PerRoomConfig } from '@ieomlabs/shared'
import type { RoomManager } from './manager.js'

interface RoomRouteOptions extends FastifyPluginOptions {
  roomManager: RoomManager
}

export async function roomRoute(app: FastifyInstance, opts: RoomRouteOptions) {
  const { roomManager } = opts

  app.get('/api/config/online', async () => {
    return roomManager.getConfig()
  })

  app.patch<{ Body: Partial<RoomConfig> }>('/api/config/online', async (req) => {
    const config = roomManager.updateConfig(req.body)
    return { ok: true, config }
  })

  app.get('/api/online/rooms', async () => {
    await roomManager.syncFromCloud()
    return roomManager.getRooms()
  })

  app.post<{ Body: { token: string } }>('/api/online/auth', async (req) => {
    const { token } = req.body ?? {}
    if (!token) return { ok: false, error: 'missing_token' }
    roomManager.setToken(token)
    return { ok: true }
  })

  app.get('/api/online/active-room', async () => {
    return { roomCode: roomManager.getActiveRoomCode() }
  })

  app.patch<{ Body: { roomCode: string | null } }>('/api/online/active-room', async (req) => {
    const { roomCode } = req.body ?? {}
    return roomManager.setActiveRoomCode(roomCode ?? null)
  })

  app.patch<{ Params: { roomCode: string }; Body: Partial<PerRoomConfig> }>('/api/online/rooms/:roomCode/config', async (req, reply) => {
    const { roomCode } = req.params
    const result = roomManager.updateRoomConfig(roomCode, req.body)
    if (!result) return reply.code(404).send({ ok: false, error: 'Room not found' })
    return { ok: true, config: result.config }
  })

  app.patch<{ Params: { roomCode: string; participantId: string }; Body: { transition: any } }>('/api/online/rooms/:roomCode/participants/:participantId/transition', async (req, reply) => {
    const { roomCode, participantId } = req.params
    const { transition } = req.body
    if (!transition) return reply.code(400).send({ ok: false, error: 'missing_transition' })
    const ok = roomManager.setParticipantTransition(roomCode, participantId, transition)
    if (!ok) return reply.code(404).send({ ok: false, error: 'Room not found' })
    return { ok: true }
  })
}

/** @deprecated Use roomRoute */
export { roomRoute as onlineRoute }
