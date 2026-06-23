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
  type DeathOverlayConfig,
  type DesktopNotificationEffectConfig,
  type NotificationBoxConfig,
  type ReviveOverlayConfig,
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
  type VictoryOverlayConfig,
  type AchievementUnlockConfig,
  type SystemAlertConfig,
  type ErrorDialogConfig,
  type FriendJoinConfig,
  type VhsGlitchConfig,
  type ScanLinesSweepConfig,
  type NeonGlowConfig,
  type ChromaticAberrationConfig,
  type FilmBurnConfig,
  type TvOffConfig,
  type BlueScreenConfig,
  type PixelTransitionConfig,
  type DialUpConnectConfig,
  type ConfettiBurstConfig,
  type XpGainConfig,
  type FireworksConfig,
  type DvdBounceConfig,
  type LevelUpConfig,
  type AudioSfxConfig,
} from '@ieomlabs/shared'

import { runDeathOverlay }          from '../transitions/DeathOverlay'
import { runDesktopNotification }   from '../transitions/DesktopNotification'
import { runVictoryOverlay }        from '../transitions/VictoryOverlay'
import { runReviveOverlay }         from '../transitions/ReviveOverlay'
import { runNotificationBox }       from '../transitions/NotificationBox'
import { runSysMessage }            from '../transitions/SysMessage'
import { runIdleOverlay }           from '../transitions/IdleOverlay'
import { runArchiveCorruption }     from '../transitions/ArchiveCorruption'
import { runNetworkGlitch }         from '../transitions/NetworkGlitch'
import { runVignettePulse }         from '../transitions/VignettePulse'
import { runScreenShake }           from '../transitions/ScreenShake'
import { runTypewriter }            from '../transitions/Typewriter'
import { runStaticBurst }           from '../transitions/StaticBurstConfigured'
import { runImageOverlay }          from '../transitions/ImageOverlay'
import { runVideoOverlay }          from '../transitions/VideoOverlay'
import { runAchievementUnlock }     from '../transitions/AchievementUnlock'
import { runSystemAlert }           from '../transitions/SystemAlert'
import { runErrorDialog }           from '../transitions/ErrorDialog'
import { runFriendJoin }            from '../transitions/FriendJoin'
import { runVhsGlitch }             from '../transitions/VhsGlitch'
import { runScanLinesSweep }        from '../transitions/ScanLinesSweep'
import { runNeonGlow }              from '../transitions/NeonGlow'
import { runChromaticAberration }   from '../transitions/ChromaticAberration'
import { runFilmBurn }              from '../transitions/FilmBurn'
import { runTvOff }                 from '../transitions/TvOff'
import { runBlueScreen }            from '../transitions/BlueScreen'
import { runPixelTransition }       from '../transitions/PixelTransition'
import { runDialUpConnect }         from '../transitions/DialUpConnect'
import { runConfettiBurst }         from '../transitions/ConfettiBurst'
import { runXpGain }                from '../transitions/XpGain'
import { runFireworks }             from '../transitions/Fireworks'
import { runDvdBounce }             from '../transitions/DvdBounce'
import { runLevelUp }               from '../transitions/LevelUp'
import { runAudioSfx }              from '../transitions/AudioSfx'

// ── Original effects ──────────────────────────────────────────────
registerEffect('death-overlay',    (cfg) => runDeathOverlay(cfg as DeathOverlayConfig))
registerEffect('victory-overlay',  (cfg) => runVictoryOverlay(cfg as VictoryOverlayConfig))
registerEffect('revive-overlay',   (cfg) => runReviveOverlay(cfg as ReviveOverlayConfig))
registerEffect('desktop-notification', (cfg) => runDesktopNotification(cfg as DesktopNotificationEffectConfig))
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

// ── New effects ───────────────────────────────────────────────────
registerEffect('achievement-unlock',   (cfg) => runAchievementUnlock(cfg as AchievementUnlockConfig))
registerEffect('system-alert',         (cfg) => runSystemAlert(cfg as SystemAlertConfig))
registerEffect('error-dialog',         (cfg) => runErrorDialog(cfg as ErrorDialogConfig))
registerEffect('friend-join',          (cfg) => runFriendJoin(cfg as FriendJoinConfig))
registerEffect('vhs-glitch',           (cfg) => runVhsGlitch(cfg as VhsGlitchConfig))
registerEffect('scan-lines-sweep',     (cfg) => runScanLinesSweep(cfg as ScanLinesSweepConfig))
registerEffect('neon-glow',            (cfg) => runNeonGlow(cfg as NeonGlowConfig))
registerEffect('chromatic-aberration', (cfg) => runChromaticAberration(cfg as ChromaticAberrationConfig))
registerEffect('film-burn',            (cfg) => runFilmBurn(cfg as FilmBurnConfig))
registerEffect('tv-off',               (cfg) => runTvOff(cfg as TvOffConfig))
registerEffect('blue-screen',          (cfg) => runBlueScreen(cfg as BlueScreenConfig))
registerEffect('pixel-transition',     (cfg) => runPixelTransition(cfg as PixelTransitionConfig))
registerEffect('dial-up-connect',      (cfg) => runDialUpConnect(cfg as DialUpConnectConfig))
registerEffect('confetti-burst',       (cfg) => runConfettiBurst(cfg as ConfettiBurstConfig))
registerEffect('xp-gain',              (cfg) => runXpGain(cfg as XpGainConfig))
registerEffect('fireworks',            (cfg) => runFireworks(cfg as FireworksConfig))
registerEffect('dvd-bounce',           (cfg) => runDvdBounce(cfg as DvdBounceConfig))
registerEffect('level-up',             (cfg) => runLevelUp(cfg as LevelUpConfig))
registerEffect('audio-sfx',            (cfg) => runAudioSfx(cfg as AudioSfxConfig))
