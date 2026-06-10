import type { WidgetDefinition } from '../../contracts/widget.js'

export const weatherDefinition: WidgetDefinition = {
  id: 'weather',
  componentType: 'weather-console',
  defaultSize: { width: 420, height: 330 },
  zIndex: 66,
  system: true,
  emits: [
    { event: 'weather:storm',  label: 'Storm detected' },
    { event: 'weather:clear',  label: 'Clear sky' },
    { event: 'weather:update', label: 'Weather updated' },
  ],
  accepts: [],
}
