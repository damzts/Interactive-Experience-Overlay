import type { CameraFeed, POVSwitchingConfig } from '@ieom/shared'
import { apiFetch, apiSend } from './client.js'

/** Data required to register a new camera feed */
export interface RegisterFeedPayload {
  label: string
  obsAddress: string
  obsPassword: string
  sceneName: string
}

/** Data that can be updated on an existing camera feed */
export interface UpdateFeedPayload {
  label?: string
  sceneName?: string
}

export async function getPovConfig(): Promise<POVSwitchingConfig> {
  return apiFetch<POVSwitchingConfig>('/api/config/pov')
}

export async function updatePovConfig(config: Partial<POVSwitchingConfig>): Promise<POVSwitchingConfig> {
  return apiFetch<POVSwitchingConfig>('/api/config/pov', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  })
}

export async function getFeeds(): Promise<CameraFeed[]> {
  return apiFetch<CameraFeed[]>('/api/pov/feeds')
}

export async function registerFeed(feed: RegisterFeedPayload): Promise<CameraFeed> {
  return apiFetch<CameraFeed>('/api/pov/feeds', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(feed),
  })
}

export async function deleteFeed(id: string): Promise<void> {
  return apiSend(`/api/pov/feeds/${encodeURIComponent(id)}`, 'DELETE')
}

export async function updateFeed(id: string, data: UpdateFeedPayload): Promise<CameraFeed> {
  return apiFetch<CameraFeed>(`/api/pov/feeds/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}
