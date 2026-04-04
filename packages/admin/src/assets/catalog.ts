import { useCallback, useEffect, useState } from 'react'
import type { MediaEntry } from '@ieom/shared'

export type AssetKind = 'image' | 'video' | 'audio'
export type AssetSource = 'filesystem' | 'games' | 'saved'

export interface AssetRecord {
  id: string
  name: string
  kind: AssetKind
  url: string
  source: AssetSource
  folder: string
  relativePath: string
  ext: string
  game?: string
  duration?: number
}

interface AssetCatalogResponse {
  assets: AssetRecord[]
}

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif']
const VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov', 'm4v']
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac']

function hasExtension(url: string, extensions: string[]) {
  const normalized = url.toLowerCase()
  return extensions.some((ext) => normalized.includes(`.${ext}`))
}

export function inferAssetKindFromUrl(url: string, fallback: AssetKind = 'image'): AssetKind {
  const normalized = url.trim().toLowerCase()
  if (!normalized) return fallback
  if (normalized.startsWith('data:image/')) return 'image'
  if (normalized.startsWith('data:video/')) return 'video'
  if (normalized.startsWith('data:audio/')) return 'audio'
  if (hasExtension(normalized, VIDEO_EXTENSIONS)) return 'video'
  if (hasExtension(normalized, AUDIO_EXTENSIONS)) return 'audio'
  if (hasExtension(normalized, IMAGE_EXTENSIONS)) return 'image'
  return fallback
}

export function isLikelyAssetUrl(value: string) {
  const normalized = value.trim().toLowerCase()
  if (!normalized) return false
  if (normalized.startsWith('data:image/')) return true
  if (normalized.startsWith('/assets/') || normalized.startsWith('/media/')) return true
  if (/^(https?:\/\/|\/|\.\/|\.\.\/)/i.test(normalized) && hasExtension(normalized, [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS, ...AUDIO_EXTENSIONS])) {
    return true
  }
  return false
}

export function mediaEntryToAsset(entry: MediaEntry): AssetRecord {
  return {
    id: entry.id,
    name: entry.name,
    kind: entry.type,
    url: entry.url,
    source: 'saved',
    folder: 'Saved Media',
    relativePath: entry.url,
    ext: entry.url.includes('.') ? `.${entry.url.split('.').pop()?.split('?')[0] ?? ''}` : '',
    duration: entry.duration,
  }
}

export async function uploadAssetFile(file: File): Promise<{ url: string; kind: AssetKind }> {
  const form = new FormData()
  form.append('file', file)
  const response = await fetch('/api/upload/asset', { method: 'POST', body: form })
  const json = await response.json() as { url?: string; error?: string }
  if (!response.ok || !json.url) {
    throw new Error(json.error ?? 'Upload failed')
  }
  return {
    url: json.url,
    kind: file.type.startsWith('video/') ? 'video' : 'image',
  }
}

export async function deleteAssetFile(url: string) {
  const response = await fetch('/api/assets', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  const json = await response.json().catch(() => ({})) as { error?: string }
  if (!response.ok) {
    throw new Error(json.error ?? 'Delete failed')
  }
}

export function useAssetCatalog() {
  const [assets, setAssets] = useState<AssetRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/assets/catalog')
      if (!response.ok) {
        throw new Error(`Catalog request failed: ${response.status}`)
      }
      const json = await response.json() as AssetCatalogResponse
      setAssets(Array.isArray(json.assets) ? json.assets : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { assets, loading, error, refresh }
}