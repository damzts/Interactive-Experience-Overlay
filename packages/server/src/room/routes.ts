/**
 * REST routes for online rooms:
 *   GET  /api/config/online — get room config
 *   PATCH /api/config/online — update room config
 *   GET  /api/online/rooms — list active rooms
 */

import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import type { RoomConfig } from '@ieomlabs/shared'
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
}

/** @deprecated Use roomRoute */
export { roomRoute as onlineRoute }
