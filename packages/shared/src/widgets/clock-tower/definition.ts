import type { WidgetDefinition } from '../../contracts/widget.js'

export const clockTowerDefinition = {
  id: 'clock-tower',
  componentType: 'clock-tower',
  defaultSize: { width: 500, height: 360 },
  zIndex: 49,
  system: true,
  emits: [
    { event: 'clock:hour',     label: 'Hour chime' },
    { event: 'clock:midnight', label: 'Midnight' },
  ],
  accepts: [],
} as const satisfies WidgetDefinition
