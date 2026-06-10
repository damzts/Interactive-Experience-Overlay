import type { WidgetDefinition } from '../../contracts/widget.js'

export const chatDefinition: WidgetDefinition = {
  id: 'chat',
  componentType: 'chat',
  defaultSize: { width: 280, height: 290 },
  zIndex: 40,
  system: true,
  emits: [{ event: 'chat:message', label: 'Message received' }],
  accepts: [{ action: 'chat:add-message', label: 'Add message' }],
}
