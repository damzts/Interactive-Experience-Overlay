import type { WidgetDefinition } from '../../contracts/widget.js'

export const broadcastSchedulerDefinition: WidgetDefinition = {
  id: 'broadcast-scheduler',
  componentType: 'broadcast-scheduler',
  defaultSize: { width: 430, height: 340 },
  zIndex: 65,
  system: true,
  emits: [{ event: 'scheduler:event-fired', label: 'Scheduled event fired' }],
  accepts: [],
}
