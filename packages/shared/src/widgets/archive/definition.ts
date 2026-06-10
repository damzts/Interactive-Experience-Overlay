import type { WidgetDefinition } from '../../contracts/widget.js'

export const archiveDefinition: WidgetDefinition = {
  id: 'archive',
  componentType: 'archive',
  defaultSize: { width: 300, height: 260 },
  zIndex: 20,
  system: true,
  emits: [],
  accepts: [],
}
