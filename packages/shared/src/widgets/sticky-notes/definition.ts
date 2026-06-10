import type { WidgetDefinition } from '../../contracts/widget.js'

export const stickyNotesDefinition: WidgetDefinition = {
  id: 'sticky-notes',
  componentType: 'sticky-notes',
  defaultSize: { width: 260, height: 290 },
  zIndex: 30,
  system: true,
  emits: [],
  accepts: [{ action: 'sticky:set-color', label: 'Set color' }],
}
