import type { WidgetDefinition } from '../contracts/widget.js'

import { galleryDefinition } from './gallery/definition.js'
import { winampWindowDefinition } from './winamp-window/definition.js'
import { musicDefinition } from './music/definition.js'
import { stickyNotesDefinition } from './sticky-notes/definition.js'
import { chatDefinition } from './chat/definition.js'
import { cameraDefinition } from './camera/definition.js'
import { cdRipperDefinition } from './cd-ripper/definition.js'
import { signalLabDefinition } from './signal-lab/definition.js'
import { broadcastSchedulerDefinition } from './broadcast-scheduler/definition.js'
import { weatherDefinition } from './weather/definition.js'
import { clockTowerDefinition } from './clock-tower/definition.js'
import { newswireDeskDefinition } from './newswire-desk/definition.js'
import { cityNavDefinition } from './city-nav/definition.js'
import { lcdDolphinsDefinition } from './lcd-dolphins/definition.js'
import { spectrumAnalyzerDefinition } from './spectrum-analyzer/definition.js'
import { equalizerRackDefinition } from './equalizer-rack/definition.js'
import { waveScopeDefinition } from './wave-scope/definition.js'
import { playlistDeckDefinition } from './playlist-deck/definition.js'
import { netMeterDefinition } from './net-meter/definition.js'
import { personaAvatarDefinition } from './persona-avatar/definition.js'
export { AVATAR_EMOTIONS, type AvatarEmotion } from './persona-avatar/definition.js'
export type { WidgetDefinition }

export const WIDGET_DEFINITIONS = [
  galleryDefinition,
  winampWindowDefinition,
  musicDefinition,
  stickyNotesDefinition,
  chatDefinition,
  cameraDefinition,
  cdRipperDefinition,
  signalLabDefinition,
  broadcastSchedulerDefinition,
  weatherDefinition,
  clockTowerDefinition,
  newswireDeskDefinition,
  cityNavDefinition,
  lcdDolphinsDefinition,
  spectrumAnalyzerDefinition,
  equalizerRackDefinition,
  waveScopeDefinition,
  playlistDeckDefinition,
  netMeterDefinition,
  personaAvatarDefinition,
] as const satisfies readonly WidgetDefinition[]

/**
 * Component types declared by widget definitions — the source half of the
 * derived WidgetComponentType union in domain/application.ts. Adding a
 * widget definition automatically extends the union; no manual edit.
 */
export type DefinedWidgetComponentType = (typeof WIDGET_DEFINITIONS)[number]['componentType']
