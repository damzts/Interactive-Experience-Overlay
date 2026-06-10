import type { WidgetDefinition } from '../../contracts/widget.js'

export const povStreamDefinition: WidgetDefinition = {
  id: 'pov-stream',
  componentType: 'pov-stream',
  defaultSize: { width: 480, height: 360 },
  zIndex: 52,
  system: true,
  emits: [
    { event: 'stream:viewer-joined', label: 'Viewer joined' },
    { event: 'stream:viewer-left',   label: 'Viewer left' },
  ],
  accepts: [],
}
