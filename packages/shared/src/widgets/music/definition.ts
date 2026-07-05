import type { WidgetDefinition } from '../../contracts/widget.js'

export const musicDefinition = {
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
    { action: 'music:play-pause', label: 'Play / Pause',   simulate: true },
    { action: 'music:prev',       label: 'Previous track', simulate: true },
    { action: 'music:next',       label: 'Next track',     simulate: true },
    { action: 'music:stop',       label: 'Stop playback' },
  ],
} as const satisfies WidgetDefinition
