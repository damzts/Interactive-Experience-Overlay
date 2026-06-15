import { mergeAppConfig } from '@ieomlabs/shared'
import type { AppConfig, Application, Scene } from '@ieomlabs/shared'
import { apiFetch } from './client.js'

type AppDelta =
  | { kind: 'upsert'; app: Application; isNew: boolean }

function findSingleApplicationDelta(
  current: AppConfig['applications'],
  next: AppConfig['applications'],
): AppDelta | null {
  // One new app appended
  if (next.length === current.length + 1) {
    const currentIds = new Set(current.map((a) => a.id))
    const added = next.filter((a) => !currentIds.has(a.id))
    if (added.length === 1) return { kind: 'upsert', app: added[0], isNew: true }
  }

  // Single in-place update (same length, same order)
  if (current.length !== next.length) return null
  let changedIndex = -1
  for (let i = 0; i < current.length; i++) {
    if (current[i].id !== next[i].id) return null
    if (JSON.stringify(current[i]) === JSON.stringify(next[i])) continue
    if (changedIndex !== -1) return null
    changedIndex = i
  }
  return changedIndex === -1 ? null : { kind: 'upsert', app: next[changedIndex], isNew: false }
}

type SceneDelta =
  | { kind: 'upsert'; scene: Scene }
  | { kind: 'delete'; id: string }

function findSingleSceneDelta(
  base: AppConfig['scenes'],
  next: AppConfig['scenes'],
): SceneDelta | null {
  const baseIds = Object.keys(base)
  const nextIds = Object.keys(next)

  const added   = nextIds.filter((id) => !base[id])
  const removed = baseIds.filter((id) => !next[id])
  const changed = nextIds.filter((id) => base[id] && JSON.stringify(base[id]) !== JSON.stringify(next[id]))

  if (removed.length === 0 && added.length === 1 && changed.length === 0)
    return { kind: 'upsert', scene: next[added[0]] }
  if (removed.length === 0 && added.length === 0 && changed.length === 1)
    return { kind: 'upsert', scene: next[changed[0]] }
  if (removed.length === 1 && added.length === 0 && changed.length === 0)
    return { kind: 'delete', id: removed[0] }

  return null
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
    const delta = findSingleApplicationDelta(currentConfig.applications, updates.applications)
    if (delta) {
      await apiFetch(
        delta.isNew
          ? '/api/config/applications'
          : `/api/config/applications/${encodeURIComponent(delta.app.id)}`,
        {
          method: delta.isNew ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(delta.app),
        },
      )
      return merged
    }
  }

  if (Object.keys(updates).length === 1 && updates.scenes) {
    const delta = findSingleSceneDelta(currentConfig.scenes, updates.scenes)
    if (delta) {
      if (delta.kind === 'upsert') {
        await apiFetch(`/api/config/scenes/${encodeURIComponent(delta.scene.id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(delta.scene),
        })
      } else {
        await apiFetch(`/api/config/scenes/${encodeURIComponent(delta.id)}`, {
          method: 'DELETE',
        })
      }
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

export async function createScene(app: Application, scene: import('@ieomlabs/shared').Scene): Promise<AppConfig> {
  const result = await apiFetch<{ ok: boolean; config: AppConfig }>('/api/config/scenes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app, scene }),
  })
  return result.config
}


