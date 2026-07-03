import type { WidgetDefinition } from '../contracts/widget.js'

import { galleryDefinition } from './gallery/definition.js'
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
import { rpgStatsDefinition } from './rpg-stats/definition.js'
import { streamQuestDefinition } from './stream-quest/definition.js'
import { combatLogWidgetDefinition } from './combat-log-widget/definition.js'
import { retroMessengerDefinition } from './retro-messenger/definition.js'
export type { WidgetDefinition }

export const WIDGET_DEFINITIONS: WidgetDefinition[] = [
  galleryDefinition,
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
  rpgStatsDefinition,
  streamQuestDefinition,
  combatLogWidgetDefinition,
  retroMessengerDefinition,
]
