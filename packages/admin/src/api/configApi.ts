import { mergeAppConfig } from '@ieom/shared'
import type { AppConfig, Application } from '@ieom/shared'

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
  const res = await fetch('/api/config')
  if (!res.ok) throw new Error(`fetchConfig failed: ${res.status}`)
  return res.json() as Promise<AppConfig>
}

export async function patchConfig(
  currentConfig: AppConfig,
  updates: Partial<AppConfig>,
): Promise<AppConfig> {
  const merged = mergeAppConfig(currentConfig, updates)

  let res: Response

  if (Object.keys(updates).length === 1 && updates.applications) {
    const changedApp = findSingleChangedApplication(currentConfig.applications, updates.applications)
    if (changedApp) {
      res = await fetch(`/api/config/applications/${encodeURIComponent(changedApp.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changedApp),
      })
    } else {
      res = await fetch('/api/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
    }
  } else {
    res = await fetch('/api/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
  }

  if (!res.ok) throw new Error(`patchConfig failed: ${res.status}`)
  return merged
}
