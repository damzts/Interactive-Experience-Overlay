import type { WidgetDefinition } from '../../contracts/widget.js'

export const waveScopeDefinition = {
  id: 'wave-scope',
  componentType: 'wave-scope',
  defaultSize: { width: 320, height: 200 },
  zIndex: 10,
  system: false,
  label: 'Wave Scope',
  emits: [],
  accepts: [],
} as const satisfies WidgetDefinition
