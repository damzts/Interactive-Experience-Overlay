import type { WidgetDefinition } from '../../contracts/widget.js'

export const equalizerRackDefinition = {
  id: 'equalizer-rack',
  componentType: 'equalizer-rack',
  defaultSize: { width: 320, height: 220 },
  zIndex: 10,
  system: false,
  label: 'Equalizer Rack',
  emits: [],
  accepts: [],
} as const satisfies WidgetDefinition
