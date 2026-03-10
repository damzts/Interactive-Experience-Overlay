/** Effect manifest — registers all effect handlers with the dispatch registry.
 *
 * Import this module once (in useSocket.ts) to arm the registry before any
 * overlay:show events arrive. To add a new effect:
 *   1. Create your run* function in transitions/
 *   2. Add a registerEffect() call here
 *   Nothing else needs changing.
 */
import { registerEffect } from './registry'

import {
  type NotificationBoxConfig,
  type TerminalToastConfig,
  type FloatiesConfig,
  type CorruptionBurstConfig,
  type NetworkGlitchConfig,
  type VignettePulseConfig,
  type ScreenShakeConfig,
  type TypewriterConfig,
  type StaticBurstConfig,
  type ImageOverlayConfig,
  type VideoOverlayConfig,
} from '@ieom/shared'

import { runDeathOverlay }      from '../transitions/DeathOverlay'
import { runVictoryOverlay }    from '../transitions/VictoryOverlay'
import { runReviveOverlay }     from '../transitions/ReviveOverlay'
import { runNotificationBox }   from '../transitions/NotificationBox'
import { runSysMessage }        from '../transitions/SysMessage'
import { runIdleOverlay }       from '../transitions/IdleOverlay'
import { runArchiveCorruption } from '../transitions/ArchiveCorruption'
import { runNetworkGlitch }     from '../transitions/NetworkGlitch'
import { runVignettePulse }     from '../transitions/VignettePulse'
import { runScreenShake }       from '../transitions/ScreenShake'
import { runTypewriter }        from '../transitions/Typewriter'
import { runStaticBurst }       from '../transitions/StaticBurstConfigured'
import { runImageOverlay }      from '../transitions/ImageOverlay'
import { runVideoOverlay }      from '../transitions/VideoOverlay'

registerEffect('death-overlay',    ()    => runDeathOverlay())
registerEffect('victory-overlay',  ()    => runVictoryOverlay())
registerEffect('revive-overlay',   ()    => runReviveOverlay())
registerEffect('notification-box', (cfg) => runNotificationBox(cfg as NotificationBoxConfig))
registerEffect('terminal-toast',   (cfg) => runSysMessage(cfg as TerminalToastConfig))
registerEffect('floaties',         (cfg) => runIdleOverlay(cfg as FloatiesConfig))
registerEffect('corruption-burst', (cfg) => runArchiveCorruption(cfg as CorruptionBurstConfig))
registerEffect('network-glitch',   (cfg) => runNetworkGlitch(cfg as NetworkGlitchConfig))
registerEffect('vignette-pulse',   (cfg) => runVignettePulse(cfg as VignettePulseConfig))
registerEffect('screen-shake',     (cfg) => runScreenShake(cfg as ScreenShakeConfig))
registerEffect('typewriter',       (cfg) => runTypewriter(cfg as TypewriterConfig))
registerEffect('static-burst',     (cfg) => runStaticBurst(cfg as StaticBurstConfig))
registerEffect('image-overlay',    (cfg) => runImageOverlay(cfg as ImageOverlayConfig))
registerEffect('video-overlay',    (cfg) => runVideoOverlay(cfg as VideoOverlayConfig))
