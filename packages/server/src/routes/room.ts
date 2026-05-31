/**
 * Room routes — allows the desktop app (or admin UI) to tell the server
 * to join/leave a cloud room as the hub.
 */

import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import type { CloudSignaling } from '../room/cloud-signaling.js'

interface RoomRouteOptions extends FastifyPluginOptions {
  cloudSignaling: CloudSignaling
}

export async function roomRoute(app: FastifyInstance, opts: RoomRouteOptions) {
  const { cloudSignaling } = opts

  app.post<{ Body: { cloudUrl: string; token: string; roomId: string } }>('/api/room/join', async (req, reply) => {
    const { cloudUrl, token, roomId } = req.body ?? {}
    if (!cloudUrl || !token || !roomId) {
      return reply.code(400).send({ ok: false, error: 'missing_params' })
    }
    await cloudSignaling.connect({ cloudUrl, token, roomId })
    return { ok: true }
  })

  app.post('/api/room/leave', async () => {
    cloudSignaling.disconnect()
    return { ok: true }
  })

  app.get('/api/room/status', async () => {
    return cloudSignaling.getStatus()
  })
}
