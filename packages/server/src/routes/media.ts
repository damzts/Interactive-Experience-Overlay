import type { FastifyInstance } from 'fastify'
import { mediaService } from '../services/MediaService.js'

export async function mediaRoute(app: FastifyInstance) {
  app.get('/api/assets/catalog', async (_req, _reply) => {
    return mediaService.getCatalog()
  })

  /** Return all games with their image URL lists */
  app.get('/api/media/list', async (_req, _reply) => {
    const cache = mediaService.getGames()
    return {
      games: cache.games,
      gameNames: Object.keys(cache.games),
      total: cache.total,
    }
  })

  /** Return a random single image URL */
  app.get('/api/media/random', async (_req, _reply) => {
    const cache = mediaService.getGames()
    const all = Object.values(cache.games).flat()
    if (all.length === 0) return { url: null }
    return { url: all[Math.floor(Math.random() * all.length)] }
  })

  /** Invalidate the scan cache (call after adding new game images) */
  app.post('/api/media/refresh', async (_req, _reply) => {
    mediaService.clearCaches()
    const cache = mediaService.getGames()
    return { ok: true, total: cache.total }
  })

  app.post('/api/assets/refresh', async (_req, _reply) => {
    mediaService.clearCaches()
    const catalog = mediaService.getCatalog()
    return { ok: true, total: catalog.assets.length }
  })

  app.delete<{ Body: { url?: string } }>('/api/assets', async (req, reply) => {
    const assetUrl = req.body?.url?.trim()
    if (!assetUrl) {
      return reply.code(400).send({ error: 'Asset URL is required.' })
    }

    const result = mediaService.deleteAsset(assetUrl)
    if ('error' in result) {
      return reply.code(result.code).send({ error: result.error })
    }

    return result
  })
}
