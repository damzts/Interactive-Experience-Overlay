import type { WidgetDefinition } from '../../contracts/widget.js'

export const cityNavDefinition: WidgetDefinition = {
  id: 'city-nav',
  componentType: 'city-navigator',
  defaultSize: { width: 450, height: 340 },
  zIndex: 47,
  system: true,
  emits: [{ event: 'map:location-changed', label: 'Location changed' }],
  accepts: [],
}
