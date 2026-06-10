import type { WidgetDefinition } from '../../contracts/widget.js'

export const cdRipperDefinition: WidgetDefinition = {
  id: 'cd-ripper',
  componentType: 'cd-ripper',
  defaultSize: { width: 420, height: 330 },
  zIndex: 64,
  system: true,
  emits: [{ event: 'cd:rip-complete', label: 'Rip completed' }],
  accepts: [],
}
