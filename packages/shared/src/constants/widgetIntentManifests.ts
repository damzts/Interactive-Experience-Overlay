import type { WidgetIntentManifest } from '../contracts/widget.js'

/**
 * Static pub/sub vocabulary for every built-in widget type.
 * Import this in the overlay (to populate the in-process registry) and on the
 * server (to serve via GET /api/wires/manifests for the admin panel).
 */
export const WIDGET_INTENT_MANIFESTS: WidgetIntentManifest[] = [
  {
    componentType: 'music',
    emits: [
      { event: 'music:play',          label: 'Track started' },
      { event: 'music:pause',         label: 'Track paused' },
      { event: 'music:track-changed', label: 'Track changed' },
    ],
    accepts: [
      { action: 'music:play-pause', label: 'Play / Pause' },
      { action: 'music:prev',       label: 'Previous track' },
      { action: 'music:next',       label: 'Next track' },
    ],
  },
  {
    componentType: 'gallery',
    emits: [{ event: 'gallery:slide-changed', label: 'Slide changed' }],
    accepts: [
      { action: 'gallery:next',     label: 'Next slide' },
      { action: 'gallery:previous', label: 'Previous slide' },
    ],
  },
  {
    componentType: 'chat',
    emits: [{ event: 'chat:message', label: 'Message received' }],
    accepts: [{ action: 'chat:add-message', label: 'Add message' }],
  },
  {
    componentType: 'sticky-notes',
    emits: [],
    accepts: [{ action: 'sticky:set-color', label: 'Set color' }],
  },
  {
    componentType: 'weather-console',
    emits: [
      { event: 'weather:storm',  label: 'Storm detected' },
      { event: 'weather:clear',  label: 'Clear sky' },
      { event: 'weather:update', label: 'Weather updated' },
    ],
    accepts: [],
  },
  {
    componentType: 'spectrum-analyzer',
    emits: [
      { event: 'audio:beat', label: 'Beat detected' },
      { event: 'audio:peak', label: 'Peak level' },
    ],
    accepts: [],
  },
  {
    componentType: 'wave-scope',
    emits: [{ event: 'audio:beat', label: 'Beat detected' }],
    accepts: [],
  },
  {
    componentType: 'equalizer-rack',
    emits: [],
    accepts: [{ action: 'eq:preset', label: 'Apply EQ preset' }],
  },
  {
    componentType: 'clock-tower',
    emits: [
      { event: 'clock:hour',     label: 'Hour chime' },
      { event: 'clock:midnight', label: 'Midnight' },
    ],
    accepts: [],
  },
  {
    componentType: 'broadcast-scheduler',
    emits: [{ event: 'scheduler:event-fired', label: 'Scheduled event fired' }],
    accepts: [],
  },
  {
    componentType: 'newswire-desk',
    emits: [{ event: 'newswire:breaking', label: 'Breaking news' }],
    accepts: [],
  },
  {
    componentType: 'city-navigator',
    emits: [{ event: 'map:location-changed', label: 'Location changed' }],
    accepts: [],
  },
  {
    componentType: 'signal-lab',
    emits: [{ event: 'signal:triggered', label: 'Signal triggered' }],
    accepts: [],
  },
  {
    componentType: 'media-deck',
    emits: [
      { event: 'media:play',  label: 'Media started' },
      { event: 'media:pause', label: 'Media paused' },
      { event: 'media:end',   label: 'Media ended' },
    ],
    accepts: [{ action: 'media:play-pause', label: 'Play / Pause' }],
  },
  {
    componentType: 'playlist-deck',
    emits: [{ event: 'playlist:track-changed', label: 'Track changed' }],
    accepts: [
      { action: 'playlist:next', label: 'Next track' },
      { action: 'playlist:prev', label: 'Previous track' },
    ],
  },
  {
    componentType: 'net-meter',
    emits: [{ event: 'net:high-usage', label: 'High network usage' }],
    accepts: [],
  },
  {
    componentType: 'cd-ripper',
    emits: [{ event: 'cd:rip-complete', label: 'Rip completed' }],
    accepts: [],
  },
  {
    componentType: 'lcd-dolphins',
    emits: [],
    accepts: [{ action: 'dolphins:set-mood', label: 'Set mood' }],
  },
  {
    componentType: 'camera',
    emits: [
      { event: 'camera:active',   label: 'Camera active' },
      { event: 'camera:inactive', label: 'Camera inactive' },
    ],
    accepts: [],
  },
  {
    componentType: 'pov-stream',
    emits: [
      { event: 'stream:viewer-joined', label: 'Viewer joined' },
      { event: 'stream:viewer-left',   label: 'Viewer left' },
    ],
    accepts: [],
  },
  { componentType: 'archive', emits: [], accepts: [] },
  { componentType: 'source',  emits: [], accepts: [] },
]
