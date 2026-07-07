import type { AppConfig, ConfigPreset } from '@ieomlabs/shared'
import { apiFetch, apiSend } from './client'

export async function fetchPresets(): Promise<ConfigPreset[]> {
  const res = await apiFetch<{ presets: ConfigPreset[] }>('/api/presets')
  return res.presets
}

export async function savePreset(label: string, sectionKeys: Array<keyof AppConfig>): Promise<void> {
  return apiSend('/api/presets', 'POST', { label, sectionKeys })
}

export async function applyPreset(id: string): Promise<void> {
  return apiSend(`/api/presets/${id}/apply`, 'POST')
}

export async function deletePreset(id: string): Promise<void> {
  return apiSend(`/api/presets/${id}`, 'DELETE')
}
