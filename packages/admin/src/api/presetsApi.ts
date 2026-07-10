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

export interface PresetBundleAsset {
  url: string
  data: string
}

export interface PresetBundle {
  bundleVersion: number
  preset: {
    id: string
    label: string
    sections: Partial<AppConfig>
    createdAt: number
  }
  assets: PresetBundleAsset[]
}

/** Fetches the full export bundle for a preset (config sections + embedded
 *  assets) as a JS object — callers that just want to trigger a file
 *  download should use `downloadPresetBundle` instead. */
export async function fetchPresetBundle(id: string): Promise<PresetBundle> {
  return apiFetch<PresetBundle>(`/api/presets/${id}/export`)
}

/** Fetches a preset's export bundle and triggers a browser download of it
 *  as a single .json file — this is the "Export" button action. */
export async function downloadPresetBundle(id: string, label: string): Promise<void> {
  const bundle = await fetchPresetBundle(id)
  const fileSafeLabel = label.replace(/[^a-z0-9_-]+/gi, '_').slice(0, 60) || 'preset'
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  try {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${fileSafeLabel}.ieompreset.json`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Imports a preset bundle (parsed from a picked .json file) — restores
 *  any embedded assets under /assets/ and saves the config sections as a
 *  new preset. Returns the saved preset plus a summary of assets written. */
export async function importPresetBundle(bundle: PresetBundle): Promise<{ preset: ConfigPreset; assets: { written: number; skipped: number } }> {
  return apiFetch(`/api/presets/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bundle),
  })
}

/** Reads a File (from an <input type="file"> picker) and parses it as a
 *  preset bundle JSON document. Throws if it isn't valid JSON. */
export async function readPresetBundleFile(file: File): Promise<PresetBundle> {
  const text = await file.text()
  return JSON.parse(text) as PresetBundle
}
