import type { AppConfig, Application, DesktopConfig } from '@ieomlabs/shared'
import { useAppStore } from '../store/useAppStore'

function throwIfRequestFailed(response: Response) {
  if (!response.ok) {
    throw new Error(`Config update failed: ${response.status}`)
  }
}

export async function patchDesktopConfig(update: Partial<DesktopConfig>) {
  const response = await fetch('/api/config/desktop', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(update),
  })
  throwIfRequestFailed(response)
}

export async function patchApplicationConfig(appId: string, update: Partial<Application>) {
  const store = useAppStore.getState()
  const previousConfig = store.config

  if (!previousConfig.applications.some((app) => app.id === appId)) {
    throw new Error(`Unknown application: ${appId}`)
  }

  const nextConfig = {
    ...previousConfig,
    applications: previousConfig.applications.map((app) => (
      app.id === appId
        ? { ...app, ...update }
        : app
    )),
  }

  store.setConfig(nextConfig)

  try {
    const response = await fetch(`/api/config/applications/${encodeURIComponent(appId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    })
    throwIfRequestFailed(response)
  } catch (error) {
    useAppStore.getState().setConfig(previousConfig)
    throw error
  }
}

export async function replaceConfig(nextConfig: AppConfig) {
  const store = useAppStore.getState()
  const previousConfig = store.config

  store.setConfig(nextConfig)

  try {
    const response = await fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nextConfig),
    })
    throwIfRequestFailed(response)
  } catch (error) {
    useAppStore.getState().setConfig(previousConfig)
    throw error
  }
}