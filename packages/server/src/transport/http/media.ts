import type { FastifyInstance } from 'fastify'
import { mediaService } from '../../services/MediaService.js'

export async function mediaRoute(app: FastifyInstance) {
  app.get('/api/assets/catalog', async (req, _reply) => {
    // request.userId is available from auth middleware on protected routes
    const _userId = req.userId
    return mediaService.getCatalog()
  })

  /** Return all games with their image URL lists */
  app.get('/api/media/list', async (req, _reply) => {
    const _userId = req.userId
    const cache = mediaService.getGames()
    return {
      games: cache.games,
      gameNames: Object.keys(cache.games),
      total: cache.total,
    }
  })

  /** Character art available for the persona avatar picker */
  app.get('/api/persona/avatar-images', async (req, _reply) => {
    const _userId = req.userId
    return { images: mediaService.getPersonaAvatarImages() }
  })

  /** Return a random single image URL */
  app.get('/api/media/random', async (req, _reply) => {
    const _userId = req.userId
    const cache = mediaService.getGames()
    const all = Object.values(cache.games).flat()
    if (all.length === 0) return { url: null }
    return { url: all[Math.floor(Math.random() * all.length)] }
  })

  /** Invalidate the scan cache (call after adding new game images) */
  app.post('/api/media/refresh', async (req, _reply) => {
    const _userId = req.userId
    mediaService.clearCaches()
    const cache = mediaService.getGames()
    return { ok: true, total: cache.total }
  })

  app.post('/api/assets/refresh', async (req, _reply) => {
    const _userId = req.userId
    mediaService.clearCaches()
    const catalog = mediaService.getCatalog()
    return { ok: true, total: catalog.assets.length }
  })

  app.delete<{ Body: { url?: string } }>('/api/assets', async (req, reply) => {
    const _userId = req.userId
    const assetUrl = req.body?.url?.trim()
    if (!assetUrl) {
      return reply.code(400).send({ error: 'Asset URL is required.' })
    }

    const result = mediaService.deleteMedia(assetUrl)
    if ('error' in result) {
      return reply.code(result.code).send({ error: result.error })
    }

    return result
  })
}

