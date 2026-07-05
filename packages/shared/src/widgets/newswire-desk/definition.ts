import type { WidgetDefinition } from '../../contracts/widget.js'

export const newswireDeskDefinition = {
  id: 'newswire-desk',
  componentType: 'newswire-desk',
  defaultSize: { width: 430, height: 340 },
  zIndex: 48,
  system: true,
  emits: [{ event: 'newswire:breaking', label: 'Breaking news' }],
  accepts: [],
} as const satisfies WidgetDefinition
