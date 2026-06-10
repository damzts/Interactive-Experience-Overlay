import type { WidgetDefinition } from '../../contracts/widget.js'

export const participantStreamDefinition: WidgetDefinition = {
  id: 'participant-stream',
  componentType: 'participant-stream',
  defaultSize: { width: 480, height: 360 },
  zIndex: 51,
  system: true,
  emits: [],
  accepts: [],
}
