import type { FastifyInstance } from 'fastify'
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MANIFEST_PATH = join(__dirname, '../../../../../imagescrap/output/manifest.csv')

interface MediaEntry {
  gameName: string
  localPath: string
}

let mediaCache: MediaEntry[] | null = null

function loadMedia(): MediaEntry[] {
  if (mediaCache) return mediaCache
  if (!existsSync(MANIFEST_PATH)) {
    console.warn('[media] manifest.csv not found at', MANIFEST_PATH)
    return (mediaCache = [])
  }

  const csv = readFileSync(MANIFEST_PATH, 'utf-8')
  const lines = csv.split('\n').slice(1) // skip header: game_name,game_url,image_url,local_path,status,error

  mediaCache = lines
    .map((line) => {
      const parts = line.split(',')
      return { gameName: parts[0]?.trim() ?? '', localPath: parts[3]?.trim() ?? '' }
    })
    .filter((e) => e.gameName && e.localPath && e.localPath.includes('imagescrap/output/'))

  console.log(`[media] indexed ${mediaCache.length} images across games`)
  return mediaCache
}

function pathToUrl(localPath: string): string {
  // "imagescrap/output/0001_Game/001.png" → "/media/games/0001_Game/001.png"
  const rel = localPath.replace(/^imagescrap\/output\//, '')
  return `/media/games/${rel}`
}

export async function mediaRoute(app: FastifyInstance) {
  /** Return all games with their image URL lists */
  app.get('/api/media/list', async (_req, _reply) => {
    const entries = loadMedia()
    const games: Record<string, string[]> = {}
    for (const e of entries) {
      if (!games[e.gameName]) games[e.gameName] = []
      games[e.gameName].push(pathToUrl(e.localPath))
    }
    return {
      games,
      gameNames: Object.keys(games),
      total: entries.length,
    }
  })

  /** Return a random single image URL */
  app.get('/api/media/random', async (_req, _reply) => {
    const entries = loadMedia()
    if (entries.length === 0) return { url: null }
    const e = entries[Math.floor(Math.random() * entries.length)]
    return { url: pathToUrl(e.localPath) }
  })
}
