import { apiFetch, apiSend } from './client.js'

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

export async function getAssetCatalog(): Promise<AssetRecord[]> {
  const json = await apiFetch<AssetCatalogResponse>('/api/assets/catalog')
  return Array.isArray(json.assets) ? json.assets : []
}

export async function uploadAsset(file: File): Promise<{ url: string; kind: AssetKind }> {
  const form = new FormData()
  form.append('file', file)
  const json = await apiFetch<{ url: string }>('/api/upload/asset', { method: 'POST', body: form })
  return {
    url: json.url,
    kind: file.type.startsWith('video/') ? 'video' : 'image',
  }
}

export async function deleteAsset(url: string): Promise<void> {
  return apiSend('/api/assets', 'DELETE', { url })
}
