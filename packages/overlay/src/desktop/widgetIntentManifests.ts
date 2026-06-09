/**
 * Widget intent manifests — static pub/sub vocabulary for every widget type.
 * Import this file once at app startup (e.g. in main.tsx) to register all manifests.
 * The admin Wires panel reads these via getAllWidgetIntentManifests().
 */
import { registerWidgetIntentManifest } from '@ieomlabs/shared'

registerWidgetIntentManifest({
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
})

registerWidgetIntentManifest({
  componentType: 'gallery',
  emits: [
    { event: 'gallery:slide-changed', label: 'Slide changed' },
  ],
  accepts: [
    { action: 'gallery:next',     label: 'Next slide' },
    { action: 'gallery:previous', label: 'Previous slide' },
  ],
})

registerWidgetIntentManifest({
  componentType: 'chat',
  emits: [
    { event: 'chat:message', label: 'Message received' },
  ],
  accepts: [
    { action: 'chat:add-message', label: 'Add message' },
  ],
})

registerWidgetIntentManifest({
  componentType: 'sticky-notes',
  emits: [],
  accepts: [
    { action: 'sticky:set-color', label: 'Set color' },
  ],
})

registerWidgetIntentManifest({
  componentType: 'weather-console',
  emits: [
    { event: 'weather:storm',  label: 'Storm detected' },
    { event: 'weather:clear',  label: 'Clear sky' },
    { event: 'weather:update', label: 'Weather updated' },
  ],
  accepts: [],
})

registerWidgetIntentManifest({
  componentType: 'spectrum-analyzer',
  emits: [
    { event: 'audio:beat', label: 'Beat detected' },
    { event: 'audio:peak', label: 'Peak level' },
  ],
  accepts: [],
})

registerWidgetIntentManifest({
  componentType: 'wave-scope',
  emits: [
    { event: 'audio:beat', label: 'Beat detected' },
  ],
  accepts: [],
})

registerWidgetIntentManifest({
  componentType: 'equalizer-rack',
  emits: [],
  accepts: [
    { action: 'eq:preset', label: 'Apply EQ preset' },
  ],
})

registerWidgetIntentManifest({
  componentType: 'clock-tower',
  emits: [
    { event: 'clock:hour',     label: 'Hour chime' },
    { event: 'clock:midnight', label: 'Midnight' },
  ],
  accepts: [],
})

registerWidgetIntentManifest({
  componentType: 'broadcast-scheduler',
  emits: [
    { event: 'scheduler:event-fired', label: 'Scheduled event fired' },
  ],
  accepts: [],
})

registerWidgetIntentManifest({
  componentType: 'newswire-desk',
  emits: [
    { event: 'newswire:breaking', label: 'Breaking news' },
  ],
  accepts: [],
})

registerWidgetIntentManifest({
  componentType: 'city-navigator',
  emits: [
    { event: 'map:location-changed', label: 'Location changed' },
  ],
  accepts: [],
})

registerWidgetIntentManifest({
  componentType: 'signal-lab',
  emits: [
    { event: 'signal:triggered', label: 'Signal triggered' },
  ],
  accepts: [],
})

registerWidgetIntentManifest({
  componentType: 'media-deck',
  emits: [
    { event: 'media:play',  label: 'Media started' },
    { event: 'media:pause', label: 'Media paused' },
    { event: 'media:end',   label: 'Media ended' },
  ],
  accepts: [
    { action: 'media:play-pause', label: 'Play / Pause' },
  ],
})

registerWidgetIntentManifest({
  componentType: 'playlist-deck',
  emits: [
    { event: 'playlist:track-changed', label: 'Track changed' },
  ],
  accepts: [
    { action: 'playlist:next', label: 'Next track' },
    { action: 'playlist:prev', label: 'Previous track' },
  ],
})

registerWidgetIntentManifest({
  componentType: 'net-meter',
  emits: [
    { event: 'net:high-usage', label: 'High network usage' },
  ],
  accepts: [],
})

registerWidgetIntentManifest({
  componentType: 'cd-ripper',
  emits: [
    { event: 'cd:rip-complete', label: 'Rip completed' },
  ],
  accepts: [],
})

registerWidgetIntentManifest({
  componentType: 'lcd-dolphins',
  emits: [],
  accepts: [
    { action: 'dolphins:set-mood', label: 'Set mood' },
  ],
})

registerWidgetIntentManifest({
  componentType: 'camera',
  emits: [
    { event: 'camera:active',   label: 'Camera active' },
    { event: 'camera:inactive', label: 'Camera inactive' },
  ],
  accepts: [],
})

registerWidgetIntentManifest({
  componentType: 'online-stream',
  emits: [
    { event: 'stream:viewer-joined', label: 'Viewer joined' },
    { event: 'stream:viewer-left',   label: 'Viewer left' },
  ],
  accepts: [],
})

registerWidgetIntentManifest({
  componentType: 'archive',
  emits: [],
  accepts: [],
})

registerWidgetIntentManifest({
  componentType: 'source',
  emits: [],
  accepts: [],
})
