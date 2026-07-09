import logger from '../lib/logger.js'
import { readdirSync, existsSync, statSync, unlinkSync, rmdirSync } from 'fs'
import { join, dirname, extname, normalize, relative } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Resolve monorepo root from packages/server/dist/services/ (compiled output)
const MONO_ROOT    = join(__dirname, '../../../..')
const GAMES_ASSETS = join(MONO_ROOT, 'assets/images/games')

const MEDIA_ROOT = join(MONO_ROOT, 'assets')

const IMAGE_EXTS         = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp'])
const CATALOG_IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.avif'])
const VIDEO_EXTS         = new Set(['.mp4', '.webm', '.mov', '.m4v'])
const AUDIO_EXTS         = new Set(['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac'])

type MediaKind = 'image' | 'video' | 'audio'

export interface MediaCatalogEntry {
  id: string
  name: string
  kind: MediaKind
  url: string
  source: 'filesystem' | 'games'
  folder: string
  relativePath: string
  ext: string
  game?: string
}

interface MediaCatalogCache {
  assets: MediaCatalogEntry[]
}

interface MediaCache {
  games: Record<string, string[]>
  total: number
}

export class MediaService {
  private mediaCache: MediaCache | null = null
  private mediaCatalogCache: MediaCatalogCache | null = null

  constructor() {}

  clearCaches(): void {
    this.mediaCache = null
    this.mediaCatalogCache = null
  }

  getCatalog(): MediaCatalogCache {
    if (this.mediaCatalogCache) return this.mediaCatalogCache

    const assets: MediaCatalogEntry[] = []
    this.scanMediaTree(MEDIA_ROOT, [], assets)

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

    this.mediaCatalogCache = { assets }
    return this.mediaCatalogCache
  }

  getGames(): MediaCache {
    if (this.mediaCache) return this.mediaCache

    if (!existsSync(GAMES_ASSETS)) {
      logger.warn({ dir: GAMES_ASSETS }, '[media] games directory not found')
      return (this.mediaCache = { games: {}, total: 0 })
    }

    const games: Record<string, string[]> = {}
    let total = 0

    for (const gameName of readdirSync(GAMES_ASSETS).sort()) {
      const gameDir = join(GAMES_ASSETS, gameName)
      try {
        if (!statSync(gameDir).isDirectory()) continue
      } catch {
        continue
      }

      const images: string[] = []
      for (const file of readdirSync(gameDir).sort()) {
        if (!IMAGE_EXTS.has(extname(file).toLowerCase())) continue
        images.push(`/assets/images/games/${encodeURIComponent(gameName)}/${encodeURIComponent(file)}`)
      }

      if (images.length > 0) {
        games[gameName] = images
        total += images.length
      }
    }

    logger.info(`[media] scanned ${Object.keys(games).length} games, ${total} images from ${GAMES_ASSETS}`)
    return (this.mediaCache = { games, total })
  }

  /** Character art for the persona avatar — every image under assets/persona/,
   *  recursively, as servable /assets/ URLs. Scanned fresh (small tree). */
  getPersonaAvatarImages(): string[] {
    const urls: string[] = []
    const walk = (dir: string, parts: string[]) => {
      if (!existsSync(dir)) return
      for (const name of readdirSync(dir).sort()) {
        const full = join(dir, name)
        let isDir: boolean
        try {
          isDir = statSync(full).isDirectory()
        } catch {
          continue
        }
        if (isDir) {
          walk(full, [...parts, name])
        } else if (IMAGE_EXTS.has(extname(name).toLowerCase())) {
          urls.push(`/assets/persona/${[...parts, name].map(encodeURIComponent).join('/')}`)
        }
      }
    }
    walk(join(MEDIA_ROOT, 'persona'), [])
    return urls
  }

  resolveMediaPath(assetUrl: string): string | null {
    if (!assetUrl.startsWith('/assets/')) return null

    const sanitizedUrl = assetUrl.split('?')[0]?.split('#')[0] ?? assetUrl
    const relativeUrlPath = decodeURIComponent(sanitizedUrl.replace(/^\/assets\//, ''))
    if (!relativeUrlPath) return null

    const normalizedRelativePath = normalize(relativeUrlPath)
    if (normalizedRelativePath.startsWith('..') || normalizedRelativePath.includes(':')) return null
    if (/^images[\\/]games(?:[\\/]|$)/i.test(normalizedRelativePath)) return null

    const absolutePath = join(MEDIA_ROOT, normalizedRelativePath)
    const relativeToRoot = relative(MEDIA_ROOT, absolutePath)
    if (relativeToRoot.startsWith('..') || relativeToRoot.includes(':')) return null

    return absolutePath
  }

  deleteMedia(assetUrl: string): { ok: true } | { error: string; code: number } {
    const assetPath = this.resolveMediaPath(assetUrl.trim())
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

  private scanMediaTree(dir: string, relativeParts: string[], assets: MediaCatalogEntry[]) {
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
        this.scanMediaTree(entryPath, nextParts, assets)
        continue
      }

      const kind = this.detectMediaKind(entryName)
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

  private detectMediaKind(fileName: string): MediaKind | null {
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

    while (currentPath.startsWith(MEDIA_ROOT) && currentPath !== MEDIA_ROOT) {
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