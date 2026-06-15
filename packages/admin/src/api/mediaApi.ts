import { apiFetch, apiSend } from './client.js'

export type MediaKind = 'image' | 'video' | 'audio'
export type MediaSource = 'filesystem' | 'games' | 'saved'

export interface MediaRecord {
  id: string
  name: string
  kind: MediaKind
  url: string
  source: MediaSource
  folder: string
  relativePath: string
  ext: string
  game?: string
  duration?: number
}

interface MediaCatalogResponse {
  assets: MediaRecord[]
}

export async function getMediaCatalog(): Promise<MediaRecord[]> {
  const json = await apiFetch<MediaCatalogResponse>('/api/assets/catalog')
  return Array.isArray(json.assets) ? json.assets : []
}

export async function uploadMedia(file: File): Promise<{ url: string; kind: MediaKind }> {
  const form = new FormData()
  form.append('file', file)
  const json = await apiFetch<{ url: string }>('/api/upload/asset', { method: 'POST', body: form })
  return {
    url: json.url,
    kind: file.type.startsWith('video/') ? 'video' : 'image',
  }
}

export async function deleteMedia(url: string): Promise<void> {
  return apiSend('/api/assets', 'DELETE', { url })
}
