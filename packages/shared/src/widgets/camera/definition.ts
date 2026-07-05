import type { WidgetDefinition } from '../../contracts/widget.js'

export const cameraDefinition = {
  id: 'camera',
  componentType: 'camera',
  defaultSize: { width: 400, height: 300 },
  zIndex: 50,
  system: true,
  emits: [
    { event: 'camera:active',   label: 'Camera active' },
    { event: 'camera:inactive', label: 'Camera inactive' },
  ],
  accepts: [],
} as const satisfies WidgetDefinition
