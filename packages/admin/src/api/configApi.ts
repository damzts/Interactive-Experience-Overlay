import { mergeAppConfig } from '@ieom/shared'
import type { AppConfig, Application } from '@ieom/shared'
import { apiFetch } from './client.js'

function findSingleChangedApplication(
  current: AppConfig['applications'],
  next: AppConfig['applications'],
): Application | null {
  if (current.length !== next.length) return null

  let changedIndex = -1
  for (let index = 0; index < current.length; index += 1) {
    if (current[index].id !== next[index].id) return null
    if (JSON.stringify(current[index]) === JSON.stringify(next[index])) continue
    if (changedIndex !== -1) return null
    changedIndex = index
  }

  return changedIndex === -1 ? null : next[changedIndex]
}

export async function fetchConfig(): Promise<AppConfig> {
  return apiFetch<AppConfig>('/api/config')
}

export async function patchConfig(
  currentConfig: AppConfig,
  updates: Partial<AppConfig>,
): Promise<AppConfig> {
  const merged = mergeAppConfig(currentConfig, updates)

  if (Object.keys(updates).length === 1 && updates.applications) {
    const changedApp = findSingleChangedApplication(currentConfig.applications, updates.applications)
    if (changedApp) {
      await apiFetch(`/api/config/applications/${encodeURIComponent(changedApp.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changedApp),
      })
      return merged
    }
  }

  await apiFetch('/api/config', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  return merged
}

export async function createScene(app: Application, scene: import('@ieom/shared').Scene): Promise<AppConfig> {
  const result = await apiFetch<{ ok: boolean; config: AppConfig }>('/api/config/scenes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app, scene }),
  })
  return result.config
}

