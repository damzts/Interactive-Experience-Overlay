import type { WidgetDefinition } from '../../contracts/widget.js'

export const musicDefinition: WidgetDefinition = {
  id: 'music',
  componentType: 'music',
  defaultSize: { width: 280, height: 250 },
  zIndex: 10,
  system: true,
  emits: [
    { event: 'music:play',          label: 'Track started' },
    { event: 'music:pause',         label: 'Track paused' },
    { event: 'music:track-changed', label: 'Track changed' },
    { event: 'music:stopped',       label: 'Playback stopped' },
  ],
  accepts: [
    { action: 'music:play-pause', label: 'Play / Pause' },
    { action: 'music:prev',       label: 'Previous track' },
    { action: 'music:next',       label: 'Next track' },
    { action: 'music:stop',       label: 'Stop playback' },
  ],
}
