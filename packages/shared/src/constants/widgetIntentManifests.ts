import type { WidgetIntentManifest } from '../contracts/widget.js'
import { WIDGET_DEFINITIONS } from '../widgets/index.js'

/**
 * Static pub/sub vocabulary for every built-in widget type.
 * Import this in the overlay (to populate the in-process registry) and on the
 * server (to serve via GET /api/wires/manifests for the admin panel).
 *
 * Derived from WIDGET_DEFINITIONS — edit a widget's definition.ts to change its manifest.
 */
export const WIDGET_INTENT_MANIFESTS: WidgetIntentManifest[] = [
  ...WIDGET_DEFINITIONS.map((d) => ({
    componentType: d.componentType,
    emits: d.emits,
    accepts: d.accepts,
  })),
  // Component types that exist without a WidgetDefinition entry
  { componentType: 'source' as const,  emits: [], accepts: [] },
]
