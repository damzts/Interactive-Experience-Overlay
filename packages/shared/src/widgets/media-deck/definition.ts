import type { WidgetDefinition } from '../../contracts/widget.js'

export const mediaDeckDefinition: WidgetDefinition = {
  id: 'media-deck',
  componentType: 'media-deck',
  defaultSize: { width: 430, height: 340 },
  zIndex: 63,
  system: true,
  emits: [
    { event: 'media:play',  label: 'Media started' },
    { event: 'media:pause', label: 'Media paused' },
    { event: 'media:end',   label: 'Media ended' },
  ],
  accepts: [{ action: 'media:play-pause', label: 'Play / Pause' }],
}
