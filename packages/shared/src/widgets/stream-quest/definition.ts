import type { WidgetDefinition } from '../../contracts/widget.js'

export const streamQuestDefinition: WidgetDefinition = {
  id: 'stream-quest',
  componentType: 'stream-quest',
  defaultSize: { width: 300, height: 190 },
  zIndex: 41,
  system: true,
  emits: [{ event: 'quest:complete', label: 'Quest completed' }],
  accepts: [{ action: 'quest:set-progress', label: 'Set progress' }],
}
