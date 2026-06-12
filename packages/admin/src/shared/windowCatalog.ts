export type { RendererFieldDef as FieldDef, RendererCatalogEntry as CatalogEntry } from '@ieomlabs/shared'
export { RENDERER_CATALOG, findRendererCatalogEntry } from '@ieomlabs/shared'

import type { Scene } from '@ieomlabs/shared'

export type SafeSceneLike = Pick<Scene, 'id' | 'label'> & {
  windows?: Scene['windows'] | null
}

export function getSafeSceneWindows(scene?: SafeSceneLike | null) {
  return Array.isArray(scene?.windows) ? scene.windows : []
}
