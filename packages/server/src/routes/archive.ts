import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import type { ObsStatusPayload } from '@ieom/shared'
import { getAllStats, incrementStat, resetStats, appendLog, getLog, clearLog } from '../db/db.js'

interface ArchiveRouteOptions extends FastifyPluginOptions {
  getObsStatus?: () => ObsStatusPayload
}

/**
 * Append an event to the persistent archive log.
 * Called from socket handlers and transition callbacks.
 */
export function appendArchiveEvent(event: string, detail?: string) {
  appendLog(event, detail)
}

export async function archiveRoute(app: FastifyInstance, options: ArchiveRouteOptions) {
  app.get('/api/archive/stats', async () => {
    return getAllStats()
  })

  app.get('/api/archive/log', async () => {
    return getLog(100)
  })

  app.post<{ Body: { key: string } }>(
    '/api/archive/increment',
    async (req, reply) => {
      const { key } = req.body
      if (!key || typeof key !== 'string') return reply.code(400).send({ error: 'key required' })
      const newValue = incrementStat(key)
      appendLog('increment', `${key}=${newValue}`)
      return { ok: true, key, value: newValue }
    },
  )

  app.post('/api/archive/reset', async () => {
    resetStats()
    clearLog()
    return { ok: true }
  })

  // OBS connection test endpoint
  app.get('/api/obs/test', async (_req, reply) => {
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
