import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import type { ObsStatusPayload } from '@ieom/shared'
import type { ObsBridge } from '../../kernel/managers/obs.js'

interface ArchiveRouteOptions extends FastifyPluginOptions {
  getObsStatus?: () => ObsStatusPayload
  obsBridge?: ObsBridge
}

export async function archiveRoute(app: FastifyInstance, options: ArchiveRouteOptions) {
  const { obsBridge, getObsStatus } = options

  // ── Connection test ──────────────────────────────────────────

  app.get('/api/obs/test', async (req, reply) => {
    const _userId = req.userId

    const status = getObsStatus?.()
    if (!status) {
      return reply.code(200).send({ connected: false, message: 'OBS bridge status is unavailable.' })
    }

    if (status.connected) {
      return reply.code(200).send({ connected: true, message: `Connected to ${status.url}` })
    }

    const retryText = status.nextRetryAt && status.retryDelayMs
      ? ` Next retry in ${Math.max(1, Math.ceil((status.nextRetryAt - Date.now()) / 1000))}s.`
      : ''
    const errorText = status.lastError ? ` ${status.lastError}.` : ''

    return reply.code(200).send({
      connected: false,
      message: `Disconnected from ${status.url}.${errorText}${retryText}`.trim(),
    })
  })

  // ── Virtual Cam toggle ───────────────────────────────────────

  app.post('/api/obs/virtualcam', async (req, reply) => {
    if (!obsBridge) return reply.code(503).send({ error: 'obs_bridge_unavailable' })
    const result = await obsBridge.toggleVirtualCam()
    return reply.code(result.ok ? 200 : 500).send(result)
  })

  // ── Start / Stop streaming ───────────────────────────────────

  app.post('/api/obs/stream/start', async (req, reply) => {
    if (!obsBridge) return reply.code(503).send({ error: 'obs_bridge_unavailable' })
    const body = req.body as { rtmpUrl?: string; streamKey?: string } | null
    const result = await obsBridge.startStreaming(body?.rtmpUrl, body?.streamKey)
    return reply.code(result.ok ? 200 : 500).send(result)
  })

  app.post('/api/obs/stream/stop', async (req, reply) => {
    if (!obsBridge) return reply.code(503).send({ error: 'obs_bridge_unavailable' })
    const result = await obsBridge.stopStreaming()
    return reply.code(result.ok ? 200 : 500).send(result)
  })

  // ── Browser Source auto-setup ────────────────────────────────

  app.post('/api/obs/setup-source', async (req, reply) => {
    if (!obsBridge) return reply.code(503).send({ error: 'obs_bridge_unavailable' })
    const body = req.body as { sourceName?: string; width?: number; height?: number } | null
    const result = await obsBridge.ensureOverlaySource(body?.sourceName, body?.width, body?.height)
    return reply.code(result.ok ? 200 : 500).send(result)
  })
}
