import { useCallback, useEffect, useState } from 'react'
import type { MediaEntry } from '@ieomlabs/shared'
import { getMediaCatalog, uploadMedia, deleteMedia } from '../api/mediaApi.js'
export type { MediaKind, MediaSource, MediaRecord } from '../api/mediaApi.js'

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif']
const VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov', 'm4v']
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac']

function hasExtension(url: string, extensions: string[]) {
  const normalized = url.toLowerCase()
  return extensions.some((ext) => normalized.includes(`.${ext}`))
}

export function inferMediaKindFromUrl(url: string, fallback: import('../api/mediaApi.js').MediaKind = 'image'): import('../api/mediaApi.js').MediaKind {
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

export function isLikelyMediaUrl(value: string) {
  const normalized = value.trim().toLowerCase()
  if (!normalized) return false
  if (normalized.startsWith('data:image/')) return true
  if (normalized.startsWith('/assets/') || normalized.startsWith('/media/')) return true
  if (/^(https?:\/\/|\/|\.\/|\.\.\/)/i.test(normalized) && hasExtension(normalized, [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS, ...AUDIO_EXTENSIONS])) {
    return true
  }
  return false
}

export function mediaEntryToRecord(entry: MediaEntry): import('../api/mediaApi.js').MediaRecord {
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

export { uploadMedia as uploadMediaFile, deleteMedia as deleteMediaFile }

export function useMediaCatalog() {
  const [assets, setAssets] = useState<import('../api/mediaApi.js').MediaRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setAssets(await getMediaCatalog())
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
