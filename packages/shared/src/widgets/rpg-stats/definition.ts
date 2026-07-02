import type { WidgetDefinition } from '../../contracts/widget.js'

export const rpgStatsDefinition: WidgetDefinition = {
  id: 'rpg-stats',
  componentType: 'rpg-stats',
  defaultSize: { width: 260, height: 220 },
  zIndex: 40,
  system: true,
  emits: [],
  accepts: [{ action: 'rpg-stats:level-up', label: 'Level up' }],
}
