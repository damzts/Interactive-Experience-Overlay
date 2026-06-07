import logger from '../lib/logger.js'
import { readdirSync, existsSync, statSync, unlinkSync, rmdirSync } from 'fs'
import { join, dirname, extname, normalize, relative } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Resolve monorepo root from packages/server/src/services/
const MONO_ROOT    = join(__dirname, '../../../../..')
const GAMES_ASSETS = join(MONO_ROOT, 'assets/images/games')
const GAMES_LEGACY = join(MONO_ROOT, '../imagescrap/output')

const ASSET_ROOT = join(MONO_ROOT, 'assets')

const IMAGE_EXTS         = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp'])
const CATALOG_IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.avif'])
const VIDEO_EXTS         = new Set(['.mp4', '.webm', '.mov', '.m4v'])
const AUDIO_EXTS         = new Set(['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac'])

type AssetKind = 'image' | 'video' | 'audio'

export interface AssetCatalogEntry {
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

export class MediaService {
  private mediaCache: MediaCache | null = null
  private assetCatalogCache: AssetCatalogCache | null = null

  private readonly gamesDir: string

  constructor() {
    this.gamesDir =
      existsSync(GAMES_ASSETS) && readdirSync(GAMES_ASSETS).length > 0
        ? GAMES_ASSETS
        : GAMES_LEGACY
  }

  clearCaches(): void {
    this.mediaCache = null
    this.assetCatalogCache = null
  }

  getCatalog(): AssetCatalogCache {
    if (this.assetCatalogCache) return this.assetCatalogCache

    const assets: AssetCatalogEntry[] = []
    this.scanAssetTree(ASSET_ROOT, [], assets)

    for (const [gameName, urls] of Object.entries(this.getGames().games)) {
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

    this.assetCatalogCache = { assets }
    return this.assetCatalogCache
  }

  getGames(): MediaCache {
    if (this.mediaCache) return this.mediaCache

    if (!existsSync(this.gamesDir)) {
      logger.warn({ dir: this.gamesDir }, '[media] games directory not found')
      return (this.mediaCache = { games: {}, total: 0 })
    }

    const games: Record<string, string[]> = {}
    let total = 0

    const isCanonical = this.gamesDir === GAMES_ASSETS
    const urlBase = isCanonical ? '/assets/images/games' : '/media/games'

    for (const gameName of readdirSync(this.gamesDir).sort()) {
      const gameDir = join(this.gamesDir, gameName)
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

    logger.info(`[media] scanned ${Object.keys(games).length} games, ${total} images from ${this.gamesDir}`)
    return (this.mediaCache = { games, total })
  }

  resolveDeletePath(assetUrl: string): string | null {
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

  deleteAsset(assetUrl: string): { ok: true } | { error: string; code: number } {
    const assetPath = this.resolveDeletePath(assetUrl.trim())
    if (!assetPath) return { error: 'Only project assets under /assets can be deleted.', code: 400 }

    if (!existsSync(assetPath)) return { error: 'Asset file not found.', code: 404 }

    let stats
    try {
      stats = statSync(assetPath)
    } catch {
      return { error: 'Asset file not found.', code: 404 }
    }

    if (!stats.isFile()) return { error: 'Only files can be deleted.', code: 400 }

    unlinkSync(assetPath)
    this.pruneEmptyDirectories(assetPath)
    this.clearCaches()

    return { ok: true }
  }

  private scanAssetTree(dir: string, relativeParts: string[], assets: AssetCatalogEntry[]) {
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
        this.scanAssetTree(entryPath, nextParts, assets)
        continue
      }

      const kind = this.detectAssetKind(entryName)
      if (!kind) continue

      const relativePath = nextParts.join('/')
      assets.push({
        id: `filesystem:${relativePath}`,
        name: entryName.replace(/\.[^.]+$/, ''),
        kind,
        url: `/assets/${this.encodePathSegments(nextParts)}`,
        source: 'filesystem',
        folder: relativeParts.join('/') || 'assets',
        relativePath,
        ext: extname(entryName).toLowerCase(),
      })
    }
  }

  private detectAssetKind(fileName: string): AssetKind | null {
    const ext = extname(fileName).toLowerCase()
    if (CATALOG_IMAGE_EXTS.has(ext)) return 'image'
    if (VIDEO_EXTS.has(ext)) return 'video'
    if (AUDIO_EXTS.has(ext)) return 'audio'
    return null
  }

  private encodePathSegments(segments: string[]): string {
    return segments.map((segment) => encodeURIComponent(segment)).join('/')
  }

  private pruneEmptyDirectories(startPath: string) {
    let currentPath = dirname(startPath)

    while (currentPath.startsWith(ASSET_ROOT) && currentPath !== ASSET_ROOT) {
      if (!existsSync(currentPath)) break
      if (readdirSync(currentPath).length > 0) break
      rmdirSync(currentPath)
      currentPath = dirname(currentPath)
    }
  }
}

export const mediaService = new MediaService()

/** @deprecated Use mediaService.clearCaches() instead */
export function clearMediaCaches() {
  mediaService.clearCaches()
}