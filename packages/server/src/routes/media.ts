import type { FastifyInstance } from 'fastify'
import { readdirSync, existsSync, statSync } from 'fs'
import { join, dirname, extname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Canonical location served at /assets/images/games — symlinked or real copy
// Fallback: original imagescrap/output location
const MONO_ROOT    = join(__dirname, '../../../..')
const GAMES_ASSETS = join(MONO_ROOT, 'assets/images/games')
const GAMES_LEGACY = join(MONO_ROOT, '../imagescrap/output')

const GAMES_DIR = existsSync(GAMES_ASSETS) && readdirSync(GAMES_ASSETS).length > 0
  ? GAMES_ASSETS
  : GAMES_LEGACY

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp'])

interface MediaCache {
  games: Record<string, string[]>
  total: number
}

let mediaCache: MediaCache | null = null

function scanGames(): MediaCache {
  if (mediaCache) return mediaCache

  if (!existsSync(GAMES_DIR)) {
    console.warn('[media] games directory not found at', GAMES_DIR)
    return (mediaCache = { games: {}, total: 0 })
  }

  const games: Record<string, string[]> = {}
  let total = 0

  const isCanonical = GAMES_DIR === GAMES_ASSETS
  const urlBase = isCanonical ? '/assets/images/games' : '/media/games'

  for (const gameName of readdirSync(GAMES_DIR).sort()) {
    const gameDir = join(GAMES_DIR, gameName)
    try {
      if (!statSync(gameDir).isDirectory()) continue
    } catch {
      continue
    }

    const images: string[] = []
    for (const file of readdirSync(gameDir).sort()) {
      if (!IMAGE_EXTS.has(extname(file).toLowerCase())) continue
      images.push(`${urlBase}/${encodeURIComponent(gameName)}/${encodeURIComponent(file)}`)
    }

    if (images.length > 0) {
      games[gameName] = images
      total += images.length
    }
  }

  console.log(`[media] scanned ${Object.keys(games).length} games, ${total} images from ${GAMES_DIR}`)
  return (mediaCache = { games, total })
}

export async function mediaRoute(app: FastifyInstance) {
  /** Return all games with their image URL lists */
  app.get('/api/media/list', async (_req, _reply) => {
    const cache = scanGames()
    return {
      games: cache.games,
      gameNames: Object.keys(cache.games),
      total: cache.total,
    }
  })

  /** Return a random single image URL */
  app.get('/api/media/random', async (_req, _reply) => {
    const cache = scanGames()
    const all = Object.values(cache.games).flat()
    if (all.length === 0) return { url: null }
    return { url: all[Math.floor(Math.random() * all.length)] }
  })

  /** Invalidate the scan cache (call after adding new game images) */
  app.post('/api/media/refresh', async (_req, _reply) => {
    mediaCache = null
    const cache = scanGames()
    return { ok: true, total: cache.total }
  })
}
