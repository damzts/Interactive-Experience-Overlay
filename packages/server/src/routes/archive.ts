import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import type { ObsStatusPayload } from '@ieom/shared'

interface ArchiveRouteOptions extends FastifyPluginOptions {
  getObsStatus?: () => ObsStatusPayload
}

export async function archiveRoute(app: FastifyInstance, options: ArchiveRouteOptions) {
  // OBS connection test endpoint
  app.get('/api/obs/test', async (req, reply) => {
    // request.userId is available from auth middleware on protected routes
    const _userId = req.userId

    const status = options.getObsStatus?.()
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
}
