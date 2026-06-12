// Backward-compat re-exports — import from @ieomlabs/shared directly for new code
export type { PluginFieldDef as FieldDef, PluginCatalogEntry as CatalogEntry } from '@ieomlabs/shared'
export { PLUGIN_CATALOG as SOURCE_CATALOG, findPluginCatalogEntry as findSourceCatalogEntry } from '@ieomlabs/shared'

import type { Scene } from '@ieomlabs/shared'

export type SafeSceneLike = Pick<Scene, 'id' | 'label'> & {
  sources?: Scene['sources'] | null
}

export function getSafeSceneSources(scene?: SafeSceneLike | null) {
  return Array.isArray(scene?.sources) ? scene.sources : []
}
