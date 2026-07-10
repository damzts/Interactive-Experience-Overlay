import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs'
import { dirname, join, normalize, relative, extname } from 'path'
import { fileURLToPath } from 'url'
import logger from '../lib/logger.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Resolve monorepo root from packages/server/dist/services/ (compiled output)
const MONO_ROOT   = join(__dirname, '../../../..')
const ASSETS_ROOT = join(MONO_ROOT, 'assets')

/** Bundle format version — bump if the shape below changes incompatibly. */
export const PRESET_BUNDLE_VERSION = 1

export interface PresetBundleAsset {
  /** The original /assets/... URL referenced from the config sections */
  url: string
  /** Base64-encoded file contents */
  data: string
}

export interface PresetBundle {
  bundleVersion: number
  preset: {
    id: string
    label: string
    sections: Record<string, unknown>
    createdAt: number
  }
  assets: PresetBundleAsset[]
}

/** Recursively walks an arbitrary JSON value and collects every string that
 *  looks like a project-local asset reference (`/assets/...`). Works across
 *  any config shape (media fields, avatar image arrays, custom URLs, etc.)
 *  without needing per-field schema knowledge. */
export function collectAssetUrls(value: unknown, into: Set<string> = new Set()): Set<string> {
  if (typeof value === 'string') {
    if (value.startsWith('/assets/')) into.add(value.split('?')[0]?.split('#')[0] ?? value)
    return into
  }
  if (Array.isArray(value)) {
    for (const item of value) collectAssetUrls(item, into)
    return into
  }
  if (value && typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) collectAssetUrls(v, into)
  }
  return into
}

/** Resolves a `/assets/...` URL to an absolute filesystem path, rejecting
 *  any traversal attempt. Mirrors MediaService.resolveMediaPath. */
function resolveAssetPath(assetUrl: string): string | null {
  if (!assetUrl.startsWith('/assets/')) return null
  const relativeUrlPath = decodeURIComponent(assetUrl.replace(/^\/assets\//, ''))
  if (!relativeUrlPath) return null

  const normalizedRelativePath = normalize(relativeUrlPath)
  if (normalizedRelativePath.startsWith('..') || normalizedRelativePath.includes(':')) return null

  const absolutePath = join(ASSETS_ROOT, normalizedRelativePath)
  const relativeToRoot = relative(ASSETS_ROOT, absolutePath)
  if (relativeToRoot.startsWith('..') || relativeToRoot.includes(':')) return null

  return absolutePath
}

const ALLOWED_ASSET_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif',
  '.mp4', '.webm', '.mov', '.m4v',
  '.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac',
])

/** Reads every asset referenced by `sections` from disk and returns them as
 *  base64 blobs alongside their original URL, for embedding in an export
 *  bundle. Missing files are skipped (logged) rather than failing the export. */
export function packAssetsForSections(sections: Record<string, unknown>): PresetBundleAsset[] {
  const urls = collectAssetUrls(sections)
  const assets: PresetBundleAsset[] = []

  for (const url of urls) {
    const absolutePath = resolveAssetPath(url)
    if (!absolutePath) {
      logger.warn({ url }, '[presets] skipping asset with unsafe path during export')
      continue
    }
    if (!ALLOWED_ASSET_EXTS.has(extname(absolutePath).toLowerCase())) {
      logger.warn({ url }, '[presets] skipping asset with disallowed extension during export')
      continue
    }
    if (!existsSync(absolutePath)) {
      logger.warn({ url }, '[presets] asset referenced by preset not found on disk, skipping')
      continue
    }
    try {
      const data = readFileSync(absolutePath).toString('base64')
      assets.push({ url, data })
    } catch (err) {
      logger.warn({ url, err }, '[presets] failed to read asset during export')
    }
  }

  return assets
}

/** Writes bundle assets back to disk under assets/, recreating the same
 *  relative paths they were exported from. Existing files are overwritten
 *  so re-importing the same bundle is idempotent. Returns the count written. */
export function unpackAssetsFromBundle(assets: PresetBundleAsset[]): { written: number; skipped: number } {
  let written = 0
  let skipped = 0

  for (const asset of assets) {
    const absolutePath = resolveAssetPath(asset.url)
    if (!absolutePath) {
      logger.warn({ url: asset.url }, '[presets] skipping asset with unsafe path during import')
      skipped++
      continue
    }
    if (!ALLOWED_ASSET_EXTS.has(extname(absolutePath).toLowerCase())) {
      logger.warn({ url: asset.url }, '[presets] skipping asset with disallowed extension during import')
      skipped++
      continue
    }
    try {
      mkdirSync(dirname(absolutePath), { recursive: true })
      writeFileSync(absolutePath, Buffer.from(asset.data, 'base64'))
      written++
    } catch (err) {
      logger.warn({ url: asset.url, err }, '[presets] failed to write asset during import')
      skipped++
    }
  }

  return { written, skipped }
}
