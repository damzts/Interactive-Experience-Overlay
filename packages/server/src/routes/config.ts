import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import type { SceneMachine } from '../state/machine.js'
import { DEFAULT_CONFIG } from '@ieom/shared'
import type { AppConfig } from '@ieom/shared'

/** In-memory config store for v1 */
let config: AppConfig = structuredClone(DEFAULT_CONFIG)

export function getConfig() {
  return config
}

export async function configRoute(
  app: FastifyInstance,
  opts: FastifyPluginOptions & { machine: SceneMachine },
) {
  app.get('/api/config', async (_req, _reply) => {
    return config
  })

  app.put<{ Body: AppConfig }>('/api/config', async (req, reply) => {
    try {
      config = req.body
      // Broadcast to all overlay/admin clients
      opts.machine.emit('config:update', config)
      return { ok: true }
    } catch (e) {
      return reply.code(400).send({ ok: false, error: String(e) })
    }
  })
}
