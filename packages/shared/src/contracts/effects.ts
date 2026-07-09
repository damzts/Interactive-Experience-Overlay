/** ── Effect types ─────────────────────────────────────────────────
 *  Every event has an EffectConfig[] — a stack of zero or more effects
 *  that fire together (each with an optional delay).
 *  All events are uniform: no "built-in" vs custom distinction.
 */
import type { SequenceStep } from '../domain/sequence.js'

/** Maps each effect type name to its config shape. This is the single
 *  source of truth for effect types: `EffectType` and the `EffectConfig`
 *  discriminated union are derived from it, so adding an effect means
 *  adding one entry here plus its config interface below. */
export interface EffectConfigMap {
  // ── Stream personality effects ────────────────────────────────
  'cinema-moment': CinemaMomentConfig         // Letterbox bars + vignette + dramatic text
  'chapter-reveal': ChapterRevealConfig       // Full-screen elegant title card
  'clip-that': ClipThatConfig                 // "✂ CLIP IT" badge pulses in corner
  'persona-shift': PersonaShiftConfig         // Color wash + bold mode-change text
  'moment-marker': MomentMarkerConfig         // "★ MOMENT" badge stamps corner then fades
  'crowd-roar': CrowdRoarConfig               // Screen shake + vignette flash + "CROWD GOES WILD"
  'intermission': IntermissionConfig          // Full-screen BRB card with animated background
  'shockwave': ShockwaveConfig                // Expanding ring from screen center
  'hype-pulse': HypePulseConfig               // Rainbow border cycling for duration
  'countdown-burst': CountdownBurstConfig     // 3 → 2 → 1 number slams to screen
  'spotlight': SpotlightConfig                // Dark radial mask with moving light circle
  'chat-bubble': ChatBubbleConfig             // Pinned speech bubble with text
  // ── Original effects ──────────────────────────────────────────
  'desktop-notification': DesktopNotificationEffectConfig // Desktop taskbar/toast notification
  'notification-box': NotificationBoxConfig   // Win98 dialog window(s), cascade via flex stack
  'terminal-toast': TerminalToastConfig       // [SERVER]: message prints at chosen corner
  'floaties': FloatiesConfig                  // Glowing terminal symbols drift across screen
  'corruption-burst': CorruptionBurstConfig   // Glitch rect burst + scanline sweep
  'network-glitch': NetworkGlitchConfig       // Screen shake + interruption banner
  'vignette-pulse': VignettePulseConfig       // Color vignette floods screen, optional text
  'screen-shake': ScreenShakeConfig           // Camera shake only, no overlay
  'typewriter': TypewriterConfig              // Text types itself on screen
  'static-burst': StaticBurstConfig           // TV static noise flash
  // ── Media overlays ────────────────────────────────────────────
  'image-overlay': ImageOverlayConfig         // Transparent image/PNG/APNG on screen (alert graphics etc.)
  'video-overlay': VideoOverlayConfig         // Transparent video/WebM on screen
  // ── Built-in animation wrappers ───────────────────────────────
  'death-overlay': DeathOverlayConfig         // Original YOU DIED red vignette animation
  'victory-overlay': VictoryOverlayConfig     // Original Win98 MISSION.LOG dialog
  'revive-overlay': ReviveOverlayConfig       // Original Restarting process terminal animation
  // ── Notifications ─────────────────────────────────────────────
  'achievement-unlock': AchievementUnlockConfig // Xbox 360 toast from bottom-right
  'system-alert': SystemAlertConfig           // Vista UAC-style center dialog
  'error-dialog': ErrorDialogConfig           // Win98/XP error box with phantom OK button
  'friend-join': FriendJoinConfig             // Xbox Live / Messenger friend-joined slide-in
  // ── Screen distortion ─────────────────────────────────────────
  'vhs-glitch': VhsGlitchConfig               // VHS tape tracking artifacts + RGB displacement
  'scan-lines-sweep': ScanLinesSweepConfig    // CRT scanline gradient sweeps top-to-bottom
  'neon-glow': NeonGlowConfig                 // Neon border pulse around screen edges
  'chromatic-aberration': ChromaticAberrationConfig // RGB channel offset on overlapping clones
  'film-burn': FilmBurnConfig                 // Warm overexposure wash from screen corner
  // ── Transitions ───────────────────────────────────────────────
  'tv-off': TvOffConfig                       // CRT shutdown: scaleY collapse → dot → black
  'blue-screen': BlueScreenConfig             // BSOD blue flash with scrolling error text
  'pixel-transition': PixelTransitionConfig   // Grid of pixels scatter then reassemble
  'dial-up-connect': DialUpConnectConfig      // Modem handshake terminal animation
  // ── Particles & Ambient ───────────────────────────────────────
  'confetti-burst': ConfettiBurstConfig       // Colored paper confetti rains from top
  'xp-gain': XpGainConfig                     // Floating "+XP" text bubbles drift upward
  'fireworks': FireworksConfig                // Star particles arc outward from center
  // ── Animations ────────────────────────────────────────────────
  'dvd-bounce': DvdBounceConfig               // Text bounces around screen like DVD screensaver
  'level-up': LevelUpConfig                   // "LEVEL UP" zoom + expanding ring shockwave
  // ── Audio-only ────────────────────────────────────────────────
  'audio-sfx': AudioSfxConfig                 // No visual — plays a built-in or custom sound
  // ── 2000s Internet Nostalgia ──────────────────────────────────
  'aim-message': AimMessageConfig             // AOL Instant Messenger window slides in
  'msn-nudge': MsnNudgeConfig                 // Windows Live Messenger NUDGE + screen shake
  'xp-balloon': XpBalloonConfig               // Windows XP system tray balloon notification
  'geocities-alert': GeoAimAlertConfig        // Browser JS alert() dialog with blinking border
  'buffering': BufferingConfig                // Early YouTube buffering progress bar
  'winamp-skip': WinampSkipConfig             // Winamp media player track skip widget
  'email-alert': EmailAlertConfig             // Hotmail/AOL new-message notification card
  // ── Anime ─────────────────────────────────────────────────────
  'speed-lines': SpeedLinesConfig             // Canvas radial speed lines from/to center
  'impact-frame': ImpactFrameConfig           // Flash + ink speed lines + bold impact text
  'power-up-aura': PowerUpAuraConfig          // DBZ-style expanding golden rings + aura column
  'to-be-continued': ToBeContinuedConfig      // JoJo sepia wipe + "→ To Be Continued..." text
  'screentone-wipe': ScreentoneWipeConfig     // Manga halftone dot pattern wipes across screen
  'sweat-drop': SweatDropConfig               // Giant anime sweat drop slides, wobbles, splashes
  'dramatic-zoom': DramaticZoomConfig         // Slow camera zoom in + speed lines, tension build
  // ── MMORPG / Retro-Futurist ─────────────────────────────────────
  'item-pickup': ItemPickupConfig             // Loot explosion with rarity-colored burst + item name
  'quest-complete': QuestCompleteConfig       // Quest banner fanfare slides in, holds, slides out
  'critical-hit': CriticalHitConfig           // Screen flash + big impact damage text
  'boss-warning': BossWarningConfig           // Metal Gear "!" alert — red flash + warning banner
  'combo-multiplier': ComboMultiplierConfig   // Fighting-game combo counter increments and slams
  'game-over-effect': GameOverEffectConfig    // Retro pixel-art GAME OVER wipe
  'matrix-glitch': MatrixGlitchConfig         // Matrix-rain dissolve transition
  // ── Colorful particles & light ──────────────────────────────────
  'aurora-wave': AuroraWaveConfig             // Flowing aurora ribbons undulate across the screen
  'starfall': StarfallConfig                  // Shooting stars streak down with glowing trails
  'bubble-pop': BubblePopConfig               // Glossy iridescent bubbles rise, wobble, and pop
  'glitter-bomb': GlitterBombConfig           // Twinkling glitter explosion from screen center
  'laser-sweep': LaserSweepConfig             // Synthwave laser beams sweep across the screen
  // ── Aesthetic Cartridges (retrofuturism/nostalgia remix set) ─────
  'halo-charge': HaloChargeConfig             // Aero Saint — spinning glass halo detonates into a white-out bloom
  'item-get': ItemGetConfig                   // Chrome Requiem — server-announcement loot ticker slams across the screen
  'sick-trick': SickTrickConfig                // Trick City — diagonal spray streak wipe + racking combo callout
  'save-point-chime': SavePointChimeConfig    // Save Point — JRPG level-up card with job title, ATB gauge freeze-fill
  'sign-on-ping': SignOnPingConfig            // Dial Tone Dream — Y2K buddy-list sign-on card + door chime
  'next-episode': NextEpisodeConfig           // Signal Ghost — VHS-tracking anime bumper title card
  'podium-take': PodiumTakeConfig             // Podium Chrome — glass medal-ceremony podium card + confetti chrome
  // ── Sequential / exclusive ─────────────────────────────────────
  'sequence': SequenceEffectConfig            // Ordered step pipeline (built-in animation, media, or renderer); never dropped, cancels its own prior run
  'screensaver': ScreenSaverConfig            // Full-screen idle takeover; runs until dismissed, cancels its own prior run
  // ── Screen transitions (ported from the old built-in transition catalog) ─
  'fade': FadeTransitionConfig                // Cross-fade through black
  'glitch-burst': GlitchBurstTransitionConfig // Rapid chromatic-shift flash cut
  'wipe-left': WipeLeftConfig                 // Black panel sweeps in from the right, cuts, exits left
  'wipe-right': WipeRightConfig               // Black panel sweeps in from the left, cuts, exits right
  'boot-sequence': BootSequenceConfig         // BIOS POST text → progress bar → fade
  'win98-loading': Win98LoadingConfig         // Win98 "Loading…" dialog + progress bar, flash cut
  'crt-wipe': CrtWipeConfig                   // CRT static floods the screen, fades to reveal content
  'channel-sweep': ChannelSweepConfig         // Horizontal scan-line sweep, like changing a TV channel
}

export type EffectType = keyof EffectConfigMap

// ── Per-type configs ────────────────────────────────────────────

export interface DesktopNotificationEffectConfig {
  title: string
  body: string
  icon?: string
  durationMs?: number
}

export interface NotificationBoxConfig {
  title: string
  body: string
  icon: string
  /** Seconds before auto-dismiss. 0 = stays until closed manually. */
  autoDismiss: number
}

export interface TerminalToastConfig {
  messages: string[]
  /** Total display time in seconds */
  duration: number
  position: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right'
}

export interface FloatiesConfig {
  count: number
  /** Duration in seconds */
  duration: number
  /** Speed multiplier (0.5 = half speed, 2.0 = double) */
  speed: number
}

export interface CorruptionBurstConfig {
  intensity: 'low' | 'medium' | 'high'
  /** Duration in seconds */
  duration: number
}

export interface NetworkGlitchConfig {
  message: string
  /** Duration in seconds */
  duration: number
}

export interface VignettePulseConfig {
  color: string
  /** 0–1 */
  opacity: number
  /** Duration (full cycle: in + hold + out) in seconds */
  duration: number
  /** Optional text centered on screen */
  text: string
}

export interface ScreenShakeConfig {
  intensity: 'light' | 'medium' | 'heavy'
  /** Duration in seconds */
  duration: number
}

export interface TypewriterConfig {
  text: string
  position: 'top' | 'center' | 'bottom'
  color: string
  /** px */
  fontSize: number
  /** Duration in seconds */
  duration: number
}

export interface StaticBurstConfig {
  /** 0–1 */
  opacity: number
  /** Duration in seconds */
  duration: number
}

// ── Media overlay configs ───────────────────────────────────────

export interface ImageOverlayConfig {
  /** URL or /assets/… path. PNG/APNG with transparency supported. */
  src: string
  /** px from left edge; omit to center horizontally */
  x?: number
  /** px from top edge; omit to center vertically */
  y?: number
  /** Output width in px; omit to use natural image width */
  width?: number
  /** Output height in px; omit to use natural image height */
  height?: number
  /** 0–1, default 1 */
  opacity?: number
  /** How long (seconds) the image stays on screen */
  duration: number
}

export interface VideoOverlayConfig {
  /** URL or /assets/… path. WebM with alpha channel for transparency. */
  src: string
  x?: number
  y?: number
  width?: number
  height?: number
  /** 0–1, default 1 */
  opacity?: number
  /** Duration in seconds. 0 = play to end once. */
  duration: number
  loop?: boolean
}

// ── Built-in animation wrapper configs ─────────────────────────
// These wrap the original hardcoded animations so they can be composed
// with other effects in the stack like any other effect type.

export interface BuiltInOverlayTimingConfig {
  /** Playback speed multiplier. 1 = normal speed. */
  speed?: number
}

export interface DeathOverlayConfig extends BuiltInOverlayTimingConfig {}
export interface VictoryOverlayConfig extends BuiltInOverlayTimingConfig {}
export interface ReviveOverlayConfig extends BuiltInOverlayTimingConfig {}

// ── Screen transition configs (ported from the old built-in transition
// catalog — same BuiltInOverlayTimingConfig speed-multiplier pattern) ──

export interface FadeTransitionConfig extends BuiltInOverlayTimingConfig {}
export interface GlitchBurstTransitionConfig extends BuiltInOverlayTimingConfig {}
export interface WipeLeftConfig extends BuiltInOverlayTimingConfig {}
export interface WipeRightConfig extends BuiltInOverlayTimingConfig {}
export interface BootSequenceConfig extends BuiltInOverlayTimingConfig {}
export interface Win98LoadingConfig extends BuiltInOverlayTimingConfig {}
export interface CrtWipeConfig extends BuiltInOverlayTimingConfig {}
export interface ChannelSweepConfig extends BuiltInOverlayTimingConfig {}

// ── New effect configs ──────────────────────────────────────────

export interface AchievementUnlockConfig {
  title: string
  description: string
  points?: number
  icon?: string
  durationMs?: number
}

export interface SystemAlertConfig {
  title: string
  message: string
  durationMs?: number
}

export interface ErrorDialogConfig {
  title: string
  message: string
  durationMs?: number
}

export interface FriendJoinConfig {
  username: string
  tagline?: string
  durationMs?: number
}

export interface VhsGlitchConfig {
  intensity: 'subtle' | 'moderate' | 'extreme'
  /** Duration in seconds */
  duration: number
}

export interface ScanLinesSweepConfig {
  color?: string
  /** 0–1, default 0.15 */
  opacity?: number
  /** Duration in seconds */
  duration: number
}

export interface NeonGlowConfig {
  color?: string
  intensity: 'soft' | 'medium' | 'intense'
  /** Cycle through hues automatically */
  rainbow?: boolean
  /** Duration in seconds */
  duration: number
}

export interface ChromaticAberrationConfig {
  intensity: 'subtle' | 'moderate' | 'extreme'
  /** Duration in seconds */
  duration: number
}

export interface FilmBurnConfig {
  corner: 'tl' | 'tr' | 'bl' | 'br'
  /** Duration in seconds */
  duration: number
}

export interface TvOffConfig {
  /** Duration in seconds, default 1.2 */
  duration?: number
}

export interface BlueScreenConfig {
  errorCode?: string
  message?: string
  /** Duration in seconds */
  duration: number
}

export interface PixelTransitionConfig {
  /** Pixel tile size in px, default 20 */
  pixelSize?: number
  /** Duration in seconds */
  duration: number
}

export interface DialUpConnectConfig {
  isp?: string
  /** e.g. '56k', '28.8k' */
  speed?: string
  /** Duration in seconds */
  duration: number
}

export interface ConfettiBurstConfig {
  colors?: string[]
  count?: number
  /** Duration in seconds */
  duration: number
}

export interface XpGainConfig {
  text: string
  count?: number
  color?: string
  /** px, default 36 */
  fontSize?: number
  /** Duration in seconds */
  duration: number
}

export interface FireworksConfig {
  count?: number
  colors?: string[]
  /** Duration in seconds */
  duration: number
}

export interface DvdBounceConfig {
  text?: string
  /** Duration in seconds */
  duration: number
}

/** Config for the 'screensaver' effect type — a full-viewport idle takeover.
 *  No duration: it runs until dismissed by activity (click/keydown) or by
 *  the next exclusive-effect dispatch, same lifecycle as 'sequence'. */
export interface ScreenSaverConfig {
  preset: 'flying-windows' | 'starfield' | 'marquee' | 'pipes' | 'blank' | 'gallery-scroll'
}

export interface LevelUpConfig {
  text?: string
  level?: number
  color?: string
  /** Duration in seconds */
  duration: number
}

export interface AudioSfxConfig {
  sfxId: 'startup' | 'transition' | 'death' | 'victory' | 'revive' | 'glitch'
    | 'dial-up-connect' | 'win98-error' | 'mmorpg-ding' | 'loot' | 'level-up-chime'
    | 'custom'
  /** Required when sfxId is 'custom' */
  customUrl?: string
  /** 0–1 volume multiplier, default 1 */
  volume?: number
}

// ── Effect chaining ──────────────────────────────────────────────

export interface EffectChain {
  /** Probability 0–1 that the chained effect fires once this effect fires. */
  chance: number
  /** The effect to conditionally trigger. */
  effect: EffectConfig
}

// ── Discriminated union ───────────────────────────────────────
// Derived from EffectConfigMap so each effect type appears exactly once.
// delay?: seconds before this effect fires within the stack (default 0)
// chain?: on fire, roll against chain.chance to also trigger chain.effect

export type EffectConfig = {
  [K in EffectType]: {
    type: K
    cfg: EffectConfigMap[K]
    delay?: number
    sfx?: string
    chain?: EffectChain
    /** 0-1 chance this effect fires at all, independent of chain.chance. Default 1 (always). */
    chance?: number
    /** Non-empty = only fire while the current scene id is in this list. Omit = any scene. */
    sceneIs?: string[]
  }
}[EffectType]

// ── Stream personality effect configs ───────────────────────────

export interface CinemaMomentConfig {
  text?: string
  color?: string
  /** Duration in seconds */
  duration: number
}

export interface ChapterRevealConfig {
  title: string
  number?: string | number
  subtitle?: string
  /** Duration in seconds */
  duration: number
}

export interface ClipThatConfig {
  durationMs?: number
  color?: string
}

export interface PersonaShiftConfig {
  label: string
  color?: string
  /** Duration in seconds */
  duration: number
}

export interface MomentMarkerConfig {
  label?: string
  color?: string
  durationMs?: number
}

export interface CrowdRoarConfig {
  text?: string
  /** Duration in seconds */
  duration: number
}

export interface IntermissionConfig {
  message?: string
  showTimer?: boolean
  /** Duration in seconds */
  duration: number
}

export interface ShockwaveConfig {
  color?: string
  thickness?: number
  /** Duration in seconds */
  duration: number
}

export interface HypePulseConfig {
  /** Duration in seconds */
  duration: number
  speed?: 'slow' | 'normal' | 'fast'
}

export interface CountdownBurstConfig {
  from?: number
  color?: string
}

export interface SpotlightConfig {
  /** Duration in seconds */
  duration: number
  radius?: number
  color?: string
}

export interface ChatBubbleConfig {
  text: string
  author?: string
  /** Duration in seconds */
  duration: number
  position?: 'top' | 'center' | 'bottom'
}

// ── 2000s Internet Nostalgia configs ────────────────────────────

export interface AimMessageConfig {
  username?: string
  message?: string
  durationMs?: number
}

export interface MsnNudgeConfig {
  username?: string
  durationMs?: number
}

export interface XpBalloonConfig {
  title?: string
  body?: string
  durationMs?: number
}

export interface GeoAimAlertConfig {
  message?: string
  durationMs?: number
}

export interface BufferingConfig {
  quality?: '240p' | '360p' | '480p'
  /** Duration in seconds */
  duration: number
}

export interface WinampSkipConfig {
  track?: string
  artist?: string
  durationMs?: number
}

export interface EmailAlertConfig {
  subject?: string
  sender?: string
  durationMs?: number
}

// ── Anime effect configs ─────────────────────────────────────────

export interface SpeedLinesConfig {
  direction?: 'out' | 'in'
  color?: string
  density?: number
  /** Duration in seconds */
  duration: number
}

export interface ImpactFrameConfig {
  text?: string
  color?: string
  /** Duration in seconds */
  duration: number
}

export interface PowerUpAuraConfig {
  color?: string
  text?: string
  /** Duration in seconds */
  duration: number
}

export interface ToBeContinuedConfig {
  /** Duration in seconds */
  duration: number
}

export interface ScreentoneWipeConfig {
  /** Duration in seconds */
  duration: number
  opacity?: number
}

export interface SweatDropConfig {
  durationMs?: number
  size?: 'sm' | 'md' | 'lg'
}

export interface DramaticZoomConfig {
  zoomTo?: number
  /** Duration in seconds */
  duration: number
  color?: string
}

// ── MMORPG / Retro-Futurist configs ──────────────────────────────

export interface ItemPickupConfig {
  itemName?: string
  rarity?: 'common' | 'rare' | 'epic' | 'legendary'
  durationMs?: number
}

export interface QuestCompleteConfig {
  title?: string
  reward?: string
  /** Duration in seconds */
  duration: number
}

export interface CriticalHitConfig {
  text?: string
  color?: string
  durationMs?: number
}

export interface BossWarningConfig {
  text?: string
  /** Duration in seconds */
  duration: number
}

export interface ComboMultiplierConfig {
  count?: number
  durationMs?: number
}

export interface GameOverEffectConfig {
  text?: string
  /** Duration in seconds */
  duration: number
}

export interface MatrixGlitchConfig {
  color?: string
  /** Duration in seconds */
  duration: number
}

// ── Colorful particles & light configs ───────────────────────────

export interface AuroraWaveConfig {
  colors?: string[]
  intensity?: 'soft' | 'medium' | 'intense'
  /** Duration in seconds */
  duration: number
}

export interface StarfallConfig {
  count?: number
  colors?: string[]
  /** Duration in seconds */
  duration: number
}

export interface BubblePopConfig {
  count?: number
  colors?: string[]
  /** Duration in seconds */
  duration: number
}

export interface GlitterBombConfig {
  count?: number
  colors?: string[]
  /** Duration in seconds */
  duration: number
}

export interface LaserSweepConfig {
  color?: string
  /** Cycle beam hue over time instead of a fixed color */
  rainbow?: boolean
  /** Number of beams, default 5 */
  beams?: number
  /** Duration in seconds */
  duration: number
}

// ── Aesthetic Cartridge configs ───────────────────────────────────

export interface HaloChargeConfig {
  color?: string
  text?: string
  /** Duration in seconds */
  duration: number
}

export interface ItemGetConfig {
  itemName?: string
  rarity?: 'common' | 'rare' | 'epic' | 'legendary'
  flavorText?: string
  durationMs?: number
}

export interface SickTrickConfig {
  comboLabel?: string
  score?: number
  /** Duration in seconds */
  duration: number
}

export interface SavePointChimeConfig {
  title?: string
  jobTitle?: string
  /** Duration in seconds */
  duration: number
}

export interface SignOnPingConfig {
  username?: string
  status?: string
  durationMs?: number
}

export interface NextEpisodeConfig {
  episodeNumber?: number
  title?: string
  previewText?: string
  /** Duration in seconds */
  duration: number
}

export interface PodiumTakeConfig {
  username?: string
  place?: 1 | 2 | 3
  metric?: string
  /** Duration in seconds */
  duration: number
}

// ── Sequential / exclusive config ────────────────────────────────

/** Config for the 'sequence' effect type — the generic ordered-pipeline
 *  primitive. Registered as exclusive: dispatching a new sequence cancels
 *  any run of 'sequence' still in flight, and it is never dropped for
 *  budget reasons. Reuses SequenceStep so a scene's intro/exit Sequence
 *  (resolved server-side from its introSequenceId/exitSequenceId) can
 *  dispatch through this unchanged. */
export interface SequenceEffectConfig {
  steps: SequenceStep[]
  /** Called once all steps have finished (or the sequence was empty). */
  onComplete?: () => void
}

// ── Overlay trigger payload (admin → server → overlay) ──────────

/** Full payload for overlay:trigger / overlay:show.
 *  effects is an ordered array; each fires with its optional delay. */
export interface OverlayTriggerPayload {
  id: string
  effects: EffectConfig[]
}
