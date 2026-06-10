import type { WidgetDefinition } from '../../contracts/widget.js'

export const signalLabDefinition: WidgetDefinition = {
  id: 'signal-lab',
  componentType: 'signal-lab',
  defaultSize: { width: 410, height: 320 },
  zIndex: 60,
  system: true,
  emits: [{ event: 'signal:triggered', label: 'Signal triggered' }],
  accepts: [],
}
