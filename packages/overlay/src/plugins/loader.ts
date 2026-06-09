/**
 * External widget plugin loader.
 *
 * Scans /plugins/ (served by server via /api/plugins/manifests) for widget
 * manifest.json files and registers them into the desktop widget registry.
 *
 * Manifest format:
 * {
 *   "id": "my-widget",
 *   "label": "My Widget",
 *   "icon": "🔌",
 *   "component": "./index.js",
 *   "defaultGeometry": { "width": 320, "height": 240 },
 *   "category": "custom"
 * }
 */

export interface ExternalWidgetManifest {
  id: string
  label: string
  icon: string
  component: string
  defaultGeometry?: { width: number; height: number }
  category?: string
}

/** Base URL for the plugins directory (served by Fastify static at /plugins/) */
const PLUGINS_BASE = '/plugins'

let _loaded = false

/**
 * Fetch all available external widget manifests from the server.
 * Returns empty array if the endpoint is unavailable (graceful degradation).
 */
export async function fetchExternalWidgetManifests(): Promise<ExternalWidgetManifest[]> {
  try {
    const res = await fetch(`${PLUGINS_BASE}/index.json`)
    if (!res.ok) return []
    const list = (await res.json()) as string[]
    const manifests = await Promise.allSettled(
      list.map((dir) => fetch(`${PLUGINS_BASE}/${dir}/manifest.json`).then((r) => r.json() as Promise<ExternalWidgetManifest>)),
    )
    return manifests
      .filter((r): r is PromiseFulfilledResult<ExternalWidgetManifest> => r.status === 'fulfilled')
      .map((r) => r.value)
      .filter((m) => m?.id && m?.component)
  } catch {
    return []
  }
}

/**
 * Load and register all external widget manifests.
 * Idempotent — safe to call multiple times (only loads once).
 */
export async function loadExternalWidgets(): Promise<ExternalWidgetManifest[]> {
  if (_loaded) return []
  _loaded = true

  const { registerExternalWidget } = await import('../desktop/widgetRegistry.js')
  const manifests = await fetchExternalWidgetManifests()

  for (const manifest of manifests) {
    registerExternalWidget(manifest)
  }

  if (manifests.length > 0) {
    console.info(`[plugins] Loaded ${manifests.length} external widget(s): ${manifests.map((m) => m.id).join(', ')}`)
  }

  return manifests
}
