/**
 * REST routes for online rooms:
 *   GET  /api/config/online — get online mode config
 *   PATCH /api/config/online — update online mode config
 *   GET  /api/online/rooms — list active rooms
 */

import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import type { OnlineModeConfig } from '@ieom/shared'
import type { OnlineRoomManager } from './manager.js'

interface OnlineRouteOptions extends FastifyPluginOptions {
  onlineManager: OnlineRoomManager
}

export async function onlineRoute(app: FastifyInstance, opts: OnlineRouteOptions) {
  const { onlineManager } = opts

  app.get('/api/config/online', async () => {
    return onlineManager.getConfig()
  })

  app.patch<{ Body: Partial<OnlineModeConfig> }>('/api/config/online', async (req) => {
    const config = onlineManager.updateConfig(req.body)
    return { ok: true, config }
  })

  app.get('/api/online/rooms', async () => {
    return onlineManager.getRooms()
  })

  // Allow the admin to provide a cloud auth token (for web-only mode without Electron)
  app.post<{ Body: { token: string } }>('/api/online/auth', async (req) => {
    const { token } = req.body ?? {}
    if (!token) return { ok: false, error: 'missing_token' }
    onlineManager.setToken(token)
    return { ok: true }
  })
}
