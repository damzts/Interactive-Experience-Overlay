/** Effect manifest — registers all effect handlers with the dispatch registry.
 *
 * Import this module once (in useSocket.ts) to arm the registry before any
 * overlay:show events arrive. To add a new effect:
 *   1. Add the EffectConfigMap entry + config interface in
 *      @ieomlabs/shared contracts/effects.ts, and its manifest entry
 *      (label, category, defaults, fields, defaultSfx) in
 *      domain/effectCatalog.ts — the compiler enforces both.
 *   2. Create your run* function in transitions/ and add a
 *      registerEffect() call here.
 * Admin pickers, editors, draft defaults, and the SFX mapping are all
 * derived from the catalog — no admin code, ever.
 */
import { registerEffect } from './registry'

import {
  type AimMessageConfig,
  type MsnNudgeConfig,
  type XpBalloonConfig,
  type GeoAimAlertConfig,
  type BufferingConfig,
  type WinampSkipConfig,
  type EmailAlertConfig,
  type SpeedLinesConfig,
  type ImpactFrameConfig,
  type PowerUpAuraConfig,
  type ToBeContinuedConfig,
  type ScreentoneWipeConfig,
  type SweatDropConfig,
  type DramaticZoomConfig,
  type CinemaMomentConfig,
  type ChapterRevealConfig,
  type ClipThatConfig,
  type PersonaShiftConfig,
  type MomentMarkerConfig,
  type CrowdRoarConfig,
  type IntermissionConfig,
  type ShockwaveConfig,
  type HypePulseConfig,
  type CountdownBurstConfig,
  type SpotlightConfig,
  type ChatBubbleConfig,
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
  type ItemPickupConfig,
  type QuestCompleteConfig,
  type CriticalHitConfig,
  type BossWarningConfig,
  type ComboMultiplierConfig,
  type GameOverEffectConfig,
  type MatrixGlitchConfig,
  type AuroraWaveConfig,
  type StarfallConfig,
  type BubblePopConfig,
  type GlitterBombConfig,
  type LaserSweepConfig,
  type HaloChargeConfig,
  type ItemGetConfig,
  type SickTrickConfig,
  type SavePointChimeConfig,
  type SignOnPingConfig,
  type NextEpisodeConfig,
  type PodiumTakeConfig,
} from '@ieomlabs/shared'

import { runAimMessage }            from '../transitions/AimMessage'
import { runMsnNudge }              from '../transitions/MsnNudge'
import { runXpBalloon }             from '../transitions/XpBalloon'
import { runGeoAimAlert }           from '../transitions/GeoAimAlert'
import { runBuffering }             from '../transitions/Buffering'
import { runWinampSkip }            from '../transitions/WinampSkip'
import { runEmailAlert }            from '../transitions/EmailAlert'
import { runSpeedLines }            from '../transitions/SpeedLines'
import { runImpactFrame }           from '../transitions/ImpactFrame'
import { runPowerUpAura }           from '../transitions/PowerUpAura'
import { runToBeContinued }         from '../transitions/ToBeContinued'
import { runScreentoneWipe }        from '../transitions/ScreentoneWipe'
import { runSweatDrop }             from '../transitions/SweatDrop'
import { runDramaticZoom }          from '../transitions/DramaticZoom'
import { runCinemaMoment }          from '../transitions/CinemaMoment'
import { runChapterReveal }         from '../transitions/ChapterReveal'
import { runClipThat }              from '../transitions/ClipThat'
import { runPersonaShift }          from '../transitions/PersonaShift'
import { runMomentMarker }          from '../transitions/MomentMarker'
import { runCrowdRoar }             from '../transitions/CrowdRoar'
import { runIntermission }          from '../transitions/Intermission'
import { runShockwave }             from '../transitions/Shockwave'
import { runHypePulse }             from '../transitions/HypePulse'
import { runCountdownBurst }        from '../transitions/CountdownBurst'
import { runSpotlight }             from '../transitions/Spotlight'
import { runChatBubble }            from '../transitions/ChatBubble'
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
import { runItemPickup }            from '../transitions/ItemPickup'
import { runQuestComplete }         from '../transitions/QuestComplete'
import { runCriticalHit }           from '../transitions/CriticalHit'
import { runBossWarning }           from '../transitions/BossWarning'
import { runComboMultiplier }       from '../transitions/ComboMultiplier'
import { runGameOverEffect }        from '../transitions/GameOverEffect'
import { runMatrixGlitch }          from '../transitions/MatrixGlitch'
import { runAuroraWave }            from '../transitions/AuroraWave'
import { runStarfall }              from '../transitions/Starfall'
import { runBubblePop }             from '../transitions/BubblePop'
import { runGlitterBomb }           from '../transitions/GlitterBomb'
import { runLaserSweep }            from '../transitions/LaserSweep'
import { runHaloCharge }            from '../transitions/HaloCharge'
import { runItemGet }               from '../transitions/ItemGet'
import { runSickTrick }             from '../transitions/SickTrick'
import { runSavePointChime }        from '../transitions/SavePointChime'
import { runSignOnPing }            from '../transitions/SignOnPing'
import { runNextEpisode }           from '../transitions/NextEpisode'
import { runPodiumTake }            from '../transitions/PodiumTake'

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

// ── 2000s Internet Nostalgia effects ─────────────────────────────
registerEffect('aim-message',      (cfg) => runAimMessage(cfg as AimMessageConfig))
registerEffect('msn-nudge',        (cfg) => runMsnNudge(cfg as MsnNudgeConfig))
registerEffect('xp-balloon',       (cfg) => runXpBalloon(cfg as XpBalloonConfig))
registerEffect('geocities-alert',  (cfg) => runGeoAimAlert(cfg as GeoAimAlertConfig))
registerEffect('buffering',        (cfg) => runBuffering(cfg as BufferingConfig))
registerEffect('winamp-skip',      (cfg) => runWinampSkip(cfg as WinampSkipConfig))
registerEffect('email-alert',      (cfg) => runEmailAlert(cfg as EmailAlertConfig))

// ── Anime effects ─────────────────────────────────────────────────
registerEffect('speed-lines',      (cfg) => runSpeedLines(cfg as SpeedLinesConfig))
registerEffect('impact-frame',     (cfg) => runImpactFrame(cfg as ImpactFrameConfig))
registerEffect('power-up-aura',    (cfg) => runPowerUpAura(cfg as PowerUpAuraConfig))
registerEffect('to-be-continued',  (cfg) => runToBeContinued(cfg as ToBeContinuedConfig))
registerEffect('screentone-wipe',  (cfg) => runScreentoneWipe(cfg as ScreentoneWipeConfig))
registerEffect('sweat-drop',       (cfg) => runSweatDrop(cfg as SweatDropConfig))
registerEffect('dramatic-zoom',    (cfg) => runDramaticZoom(cfg as DramaticZoomConfig))

// ── Stream personality effects ────────────────────────────────────
registerEffect('cinema-moment',    (cfg) => runCinemaMoment(cfg as CinemaMomentConfig))
registerEffect('chapter-reveal',   (cfg) => runChapterReveal(cfg as ChapterRevealConfig))
registerEffect('clip-that',        (cfg) => runClipThat(cfg as ClipThatConfig))
registerEffect('persona-shift',    (cfg) => runPersonaShift(cfg as PersonaShiftConfig))
registerEffect('moment-marker',    (cfg) => runMomentMarker(cfg as MomentMarkerConfig))
registerEffect('crowd-roar',       (cfg) => runCrowdRoar(cfg as CrowdRoarConfig))
registerEffect('intermission',     (cfg) => runIntermission(cfg as IntermissionConfig))
registerEffect('shockwave',        (cfg) => runShockwave(cfg as ShockwaveConfig))
registerEffect('hype-pulse',       (cfg) => runHypePulse(cfg as HypePulseConfig))
registerEffect('countdown-burst',  (cfg) => runCountdownBurst(cfg as CountdownBurstConfig))
registerEffect('spotlight',        (cfg) => runSpotlight(cfg as SpotlightConfig))
registerEffect('chat-bubble',      (cfg) => runChatBubble(cfg as ChatBubbleConfig))

// ── MMORPG / Retro-Futurist effects ────────────────────────────────
registerEffect('item-pickup',      (cfg) => runItemPickup(cfg as ItemPickupConfig))
registerEffect('quest-complete',   (cfg) => runQuestComplete(cfg as QuestCompleteConfig))
registerEffect('critical-hit',     (cfg) => runCriticalHit(cfg as CriticalHitConfig))
registerEffect('boss-warning',     (cfg) => runBossWarning(cfg as BossWarningConfig))
registerEffect('combo-multiplier', (cfg) => runComboMultiplier(cfg as ComboMultiplierConfig))
registerEffect('game-over-effect', (cfg) => runGameOverEffect(cfg as GameOverEffectConfig))
registerEffect('matrix-glitch',    (cfg) => runMatrixGlitch(cfg as MatrixGlitchConfig))

// ── Colorful particles & light effects ────────────────────────────
registerEffect('aurora-wave',      (cfg) => runAuroraWave(cfg as AuroraWaveConfig))
registerEffect('starfall',         (cfg) => runStarfall(cfg as StarfallConfig))
registerEffect('bubble-pop',       (cfg) => runBubblePop(cfg as BubblePopConfig))
registerEffect('glitter-bomb',     (cfg) => runGlitterBomb(cfg as GlitterBombConfig))
registerEffect('laser-sweep',      (cfg) => runLaserSweep(cfg as LaserSweepConfig))

// ── Aesthetic Cartridges ──────────────────────────────────────────
registerEffect('halo-charge',       (cfg) => runHaloCharge(cfg as HaloChargeConfig))
registerEffect('item-get',          (cfg) => runItemGet(cfg as ItemGetConfig))
registerEffect('sick-trick',        (cfg) => runSickTrick(cfg as SickTrickConfig))
registerEffect('save-point-chime',  (cfg) => runSavePointChime(cfg as SavePointChimeConfig))
registerEffect('sign-on-ping',      (cfg) => runSignOnPing(cfg as SignOnPingConfig))
registerEffect('next-episode',      (cfg) => runNextEpisode(cfg as NextEpisodeConfig))
registerEffect('podium-take',       (cfg) => runPodiumTake(cfg as PodiumTakeConfig))
