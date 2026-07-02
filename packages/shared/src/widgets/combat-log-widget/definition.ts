import type { WidgetDefinition } from '../../contracts/widget.js'

export const combatLogWidgetDefinition: WidgetDefinition = {
  id: 'combat-log-widget',
  componentType: 'combat-log-widget',
  defaultSize: { width: 320, height: 240 },
  zIndex: 42,
  system: true,
  emits: [],
  accepts: [],
}
