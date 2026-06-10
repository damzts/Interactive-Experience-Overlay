import type { WidgetDefinition } from '../../contracts/widget.js'

export const lcdDolphinsDefinition: WidgetDefinition = {
  id: 'lcd-dolphins',
  componentType: 'lcd-dolphins',
  defaultSize: { width: 320, height: 240 },
  zIndex: 46,
  system: true,
  emits: [],
  accepts: [{ action: 'dolphins:set-mood', label: 'Set mood' }],
}
