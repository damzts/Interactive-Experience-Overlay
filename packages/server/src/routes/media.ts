import type { FastifyInstance } from 'fastify'
import { readdirSync, existsSync, statSync, unlinkSync, rmdirSync } from 'fs'
import { join, dirname, extname, normalize, relative } from 'path'
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

const ASSET_ROOT = join(MONO_ROOT, 'assets')

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp'])
const CATALOG_IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.avif'])
const VIDEO_EXTS = new Set(['.mp4', '.webm', '.mov', '.m4v'])
const AUDIO_EXTS = new Set(['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac'])

type AssetKind = 'image' | 'video' | 'audio'

interface AssetCatalogEntry {
  id: string
  name: string
  kind: AssetKind
  url: string
  source: 'filesystem' | 'games'
  folder: string
  relativePath: string
  ext: string
  game?: string
}

interface AssetCatalogCache {
  assets: AssetCatalogEntry[]
}

interface MediaCache {
  games: Record<string, string[]>
  total: number
}

let mediaCache: MediaCache | null = null
let assetCatalogCache: AssetCatalogCache | null = null

export function clearMediaCaches() {
  mediaCache = null
  assetCatalogCache = null
}

function encodePathSegments(segments: string[]) {
  return segments.map((segment) => encodeURIComponent(segment)).join('/')
}

function detectAssetKind(fileName: string): AssetKind | null {
  const ext = extname(fileName).toLowerCase()
  if (CATALOG_IMAGE_EXTS.has(ext)) return 'image'
  if (VIDEO_EXTS.has(ext)) return 'video'
  if (AUDIO_EXTS.has(ext)) return 'audio'
  return null
}

function scanAssetTree(dir: string, relativeParts: string[], assets: AssetCatalogEntry[]) {
  if (!existsSync(dir)) return

  for (const entryName of readdirSync(dir).sort()) {
    if (relativeParts.length === 1 && relativeParts[0] === 'images' && entryName === 'games') {
      continue
    }

    const nextParts = [...relativeParts, entryName]
    const entryPath = join(dir, entryName)

    let stats
    try {
      stats = statSync(entryPath)
    } catch {
      continue
    }

    if (stats.isDirectory()) {
      scanAssetTree(entryPath, nextParts, assets)
      continue
    }

    const kind = detectAssetKind(entryName)
    if (!kind) continue

    const relativePath = nextParts.join('/')
    assets.push({
      id: `filesystem:${relativePath}`,
      name: entryName.replace(/\.[^.]+$/, ''),
      kind,
      url: `/assets/${encodePathSegments(nextParts)}`,
      source: 'filesystem',
      folder: relativeParts.join('/') || 'assets',
      relativePath,
      ext: extname(entryName).toLowerCase(),
    })
  }
}

function scanAssetCatalog(): AssetCatalogCache {
  if (assetCatalogCache) return assetCatalogCache

  const assets: AssetCatalogEntry[] = []
  scanAssetTree(ASSET_ROOT, [], assets)

  for (const [gameName, urls] of Object.entries(scanGames().games)) {
    for (const url of urls) {
      const fileName = decodeURIComponent(url.split('/').pop() ?? '')
      const relativePath = `games/${gameName}/${fileName}`
      assets.push({
        id: `games:${relativePath}`,
        name: fileName.replace(/\.[^.]+$/, ''),
        kind: 'image',
        url,
        source: 'games',
        folder: `games/${gameName}`,
        relativePath,
        ext: extname(fileName).toLowerCase(),
        game: gameName,
      })
    }
  }

  assets.sort((left, right) => {
    const sourceCompare = left.source.localeCompare(right.source)
    if (sourceCompare !== 0) return sourceCompare
    const kindCompare = left.kind.localeCompare(right.kind)
    if (kindCompare !== 0) return kindCompare
    const folderCompare = left.folder.localeCompare(right.folder)
    if (folderCompare !== 0) return folderCompare
    return left.name.localeCompare(right.name)
  })

  assetCatalogCache = { assets }
  return assetCatalogCache
}

function resolveDeletableAssetPath(assetUrl: string) {
  if (!assetUrl.startsWith('/assets/')) return null

  const sanitizedUrl = assetUrl.split('?')[0]?.split('#')[0] ?? assetUrl
  const relativeUrlPath = decodeURIComponent(sanitizedUrl.replace(/^\/assets\//, ''))
  if (!relativeUrlPath) return null

  const normalizedRelativePath = normalize(relativeUrlPath)
  if (normalizedRelativePath.startsWith('..') || normalizedRelativePath.includes(':')) return null
  if (/^images[\\/]games(?:[\\/]|$)/i.test(normalizedRelativePath)) return null

  const absolutePath = join(ASSET_ROOT, normalizedRelativePath)
  const relativeToRoot = relative(ASSET_ROOT, absolutePath)
  if (relativeToRoot.startsWith('..') || relativeToRoot.includes(':')) return null

  return absolutePath
}

function pruneEmptyAssetDirectories(startPath: string) {
  let currentPath = dirname(startPath)

  while (currentPath.startsWith(ASSET_ROOT) && currentPath !== ASSET_ROOT) {
    if (!existsSync(currentPath)) break
    if (readdirSync(currentPath).length > 0) break
    rmdirSync(currentPath)
    currentPath = dirname(currentPath)
  }
}

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
  app.get('/api/assets/catalog', async (_req, _reply) => {
    return scanAssetCatalog()
  })

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
    clearMediaCaches()
    const cache = scanGames()
    return { ok: true, total: cache.total }
  })

  app.post('/api/assets/refresh', async (_req, _reply) => {
    clearMediaCaches()
    const catalog = scanAssetCatalog()
    return { ok: true, total: catalog.assets.length }
  })

  app.delete<{ Body: { url?: string } }>('/api/assets', async (req, reply) => {
    const assetUrl = req.body?.url?.trim()
    if (!assetUrl) {
      return reply.code(400).send({ error: 'Asset URL is required.' })
    }

    const assetPath = resolveDeletableAssetPath(assetUrl)
    if (!assetPath) {
      return reply.code(400).send({ error: 'Only project assets under /assets can be deleted.' })
    }

    if (!existsSync(assetPath)) {
      return reply.code(404).send({ error: 'Asset file not found.' })
    }

    let stats
    try {
      stats = statSync(assetPath)
    } catch {
      return reply.code(404).send({ error: 'Asset file not found.' })
    }

    if (!stats.isFile()) {
      return reply.code(400).send({ error: 'Only files can be deleted.' })
    }

    unlinkSync(assetPath)
    pruneEmptyAssetDirectories(assetPath)
    clearMediaCaches()

    return { ok: true }
  })
}
