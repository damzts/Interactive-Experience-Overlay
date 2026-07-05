import type { WidgetDefinition } from '../../contracts/widget.js'

export const netMeterDefinition = {
  id: 'net-meter',
  componentType: 'net-meter',
  defaultSize: { width: 280, height: 180 },
  zIndex: 10,
  system: false,
  label: 'Net Meter',
  emits: [],
  accepts: [],
} as const satisfies WidgetDefinition
