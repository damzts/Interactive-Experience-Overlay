/** ── Effect types ─────────────────────────────────────────────────
 *  Every event has an EffectConfig[] — a stack of zero or more effects
 *  that fire together (each with an optional delay).
 *  All events are uniform: no "built-in" vs custom distinction.
 */

export type EffectType =
  // ── Stream personality effects ────────────────────────────────
  | 'cinema-moment'     // Letterbox bars + vignette + dramatic text
  | 'chapter-reveal'    // Full-screen elegant title card
  | 'clip-that'         // "✂ CLIP IT" badge pulses in corner
  | 'persona-shift'     // Color wash + bold mode-change text
  | 'moment-marker'     // "★ MOMENT" badge stamps corner then fades
  | 'crowd-roar'        // Screen shake + vignette flash + "CROWD GOES WILD"
  | 'intermission'      // Full-screen BRB card with animated background
  | 'shockwave'         // Expanding ring from screen center
  | 'hype-pulse'        // Rainbow border cycling for duration
  | 'countdown-burst'   // 3 → 2 → 1 number slams to screen
  | 'spotlight'         // Dark radial mask with moving light circle
  | 'chat-bubble'       // Pinned speech bubble with text
  // ── Original effects ──────────────────────────────────────────
  | 'desktop-notification' // Desktop taskbar/toast notification
  | 'notification-box'    // Win98 dialog window(s), cascade via flex stack
  | 'terminal-toast'      // [SERVER]: message prints at chosen corner
  | 'floaties'            // Glowing terminal symbols drift across screen
  | 'corruption-burst'    // Glitch rect burst + scanline sweep
  | 'network-glitch'      // Screen shake + interruption banner
  | 'vignette-pulse'      // Color vignette floods screen, optional text
  | 'screen-shake'        // Camera shake only, no overlay
  | 'typewriter'          // Text types itself on screen
  | 'static-burst'        // TV static noise flash
  // ── Media overlays ────────────────────────────────────────────
  | 'image-overlay'       // Transparent image/PNG/APNG on screen (alert graphics etc.)
  | 'video-overlay'       // Transparent video/WebM on screen
  // ── Built-in animation wrappers ───────────────────────────────
  | 'death-overlay'       // Original YOU DIED red vignette animation
  | 'victory-overlay'     // Original Win98 MISSION.LOG dialog
  | 'revive-overlay'      // Original Restarting process terminal animation
  // ── Notifications ─────────────────────────────────────────────
  | 'achievement-unlock'  // Xbox 360 toast from bottom-right
  | 'system-alert'        // Vista UAC-style center dialog
  | 'error-dialog'        // Win98/XP error box with phantom OK button
  | 'friend-join'         // Xbox Live / Messenger friend-joined slide-in
  // ── Screen distortion ─────────────────────────────────────────
  | 'vhs-glitch'          // VHS tape tracking artifacts + RGB displacement
  | 'scan-lines-sweep'    // CRT scanline gradient sweeps top-to-bottom
  | 'neon-glow'           // Neon border pulse around screen edges
  | 'chromatic-aberration'// RGB channel offset on overlapping clones
  | 'film-burn'           // Warm overexposure wash from screen corner
  // ── Transitions ───────────────────────────────────────────────
  | 'tv-off'              // CRT shutdown: scaleY collapse → dot → black
  | 'blue-screen'         // BSOD blue flash with scrolling error text
  | 'pixel-transition'    // Grid of pixels scatter then reassemble
  | 'dial-up-connect'     // Modem handshake terminal animation
  // ── Particles & Ambient ───────────────────────────────────────
  | 'confetti-burst'      // Colored paper confetti rains from top
  | 'xp-gain'             // Floating "+XP" text bubbles drift upward
  | 'fireworks'           // Star particles arc outward from center
  // ── Animations ────────────────────────────────────────────────
  | 'dvd-bounce'          // Text bounces around screen like DVD screensaver
  | 'level-up'            // "LEVEL UP" zoom + expanding ring shockwave
  // ── Audio-only ────────────────────────────────────────────────
  | 'audio-sfx'           // No visual — plays a built-in or custom sound
  // ── 2000s Internet Nostalgia ──────────────────────────────────
  | 'aim-message'         // AOL Instant Messenger window slides in
  | 'msn-nudge'           // Windows Live Messenger NUDGE + screen shake
  | 'xp-balloon'          // Windows XP system tray balloon notification
  | 'geocities-alert'     // Browser JS alert() dialog with blinking border
  | 'buffering'           // Early YouTube buffering progress bar
  | 'winamp-skip'         // Winamp media player track skip widget
  | 'email-alert'         // Hotmail/AOL new-message notification card
  // ── Anime ─────────────────────────────────────────────────────
  | 'speed-lines'         // Canvas radial speed lines from/to center
  | 'impact-frame'        // Flash + ink speed lines + bold impact text
  | 'power-up-aura'       // DBZ-style expanding golden rings + aura column
  | 'to-be-continued'     // JoJo sepia wipe + "→ To Be Continued..." text
  | 'screentone-wipe'     // Manga halftone dot pattern wipes across screen
  | 'sweat-drop'          // Giant anime sweat drop slides, wobbles, splashes
  | 'dramatic-zoom'       // Slow camera zoom in + speed lines, tension build
  // ── MMORPG / Retro-Futurist ─────────────────────────────────────
  | 'item-pickup'         // Loot explosion with rarity-colored burst + item name
  | 'quest-complete'      // Quest banner fanfare slides in, holds, slides out
  | 'critical-hit'        // Screen flash + big impact damage text
  | 'boss-warning'        // Metal Gear "!" alert — red flash + warning banner
  | 'combo-multiplier'    // Fighting-game combo counter increments and slams
  | 'game-over-effect'    // Retro pixel-art GAME OVER wipe
  | 'matrix-glitch'       // Matrix-rain dissolve transition

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

// ── Discriminated union ─────────────────────────────────────────
// delay?: seconds before this effect fires within the stack (default 0)
// chain?: on fire, roll against chain.chance to also trigger chain.effect

export type EffectConfig =
  | { type: 'desktop-notification'; cfg: DesktopNotificationEffectConfig; delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'notification-box'; cfg: NotificationBoxConfig; delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'terminal-toast';   cfg: TerminalToastConfig;   delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'floaties';         cfg: FloatiesConfig;        delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'corruption-burst'; cfg: CorruptionBurstConfig; delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'network-glitch';   cfg: NetworkGlitchConfig;   delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'vignette-pulse';   cfg: VignettePulseConfig;   delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'screen-shake';     cfg: ScreenShakeConfig;     delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'typewriter';       cfg: TypewriterConfig;      delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'static-burst';     cfg: StaticBurstConfig;     delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'image-overlay';    cfg: ImageOverlayConfig;    delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'video-overlay';    cfg: VideoOverlayConfig;    delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'death-overlay';    cfg: DeathOverlayConfig;    delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'victory-overlay';  cfg: VictoryOverlayConfig;  delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'revive-overlay';   cfg: ReviveOverlayConfig;   delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'achievement-unlock'; cfg: AchievementUnlockConfig; delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'system-alert';     cfg: SystemAlertConfig;     delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'error-dialog';     cfg: ErrorDialogConfig;     delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'friend-join';      cfg: FriendJoinConfig;      delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'vhs-glitch';       cfg: VhsGlitchConfig;       delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'scan-lines-sweep'; cfg: ScanLinesSweepConfig;  delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'neon-glow';        cfg: NeonGlowConfig;        delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'chromatic-aberration'; cfg: ChromaticAberrationConfig; delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'film-burn';        cfg: FilmBurnConfig;        delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'tv-off';           cfg: TvOffConfig;           delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'blue-screen';      cfg: BlueScreenConfig;      delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'pixel-transition'; cfg: PixelTransitionConfig; delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'dial-up-connect';  cfg: DialUpConnectConfig;   delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'confetti-burst';   cfg: ConfettiBurstConfig;   delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'xp-gain';          cfg: XpGainConfig;          delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'fireworks';        cfg: FireworksConfig;       delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'dvd-bounce';       cfg: DvdBounceConfig;       delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'level-up';         cfg: LevelUpConfig;         delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'audio-sfx';        cfg: AudioSfxConfig;        delay?: number; sfx?: string; chain?: EffectChain }
  // ── Stream personality ──────────────────────────────────────────
  | { type: 'cinema-moment';    cfg: CinemaMomentConfig;    delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'chapter-reveal';   cfg: ChapterRevealConfig;   delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'clip-that';        cfg: ClipThatConfig;        delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'persona-shift';    cfg: PersonaShiftConfig;    delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'moment-marker';    cfg: MomentMarkerConfig;    delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'crowd-roar';       cfg: CrowdRoarConfig;       delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'intermission';     cfg: IntermissionConfig;    delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'shockwave';        cfg: ShockwaveConfig;       delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'hype-pulse';       cfg: HypePulseConfig;       delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'countdown-burst';  cfg: CountdownBurstConfig;  delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'spotlight';        cfg: SpotlightConfig;       delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'chat-bubble';      cfg: ChatBubbleConfig;      delay?: number; sfx?: string; chain?: EffectChain }
  // ── 2000s Internet Nostalgia ──────────────────────────────────
  | { type: 'aim-message';      cfg: AimMessageConfig;      delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'msn-nudge';        cfg: MsnNudgeConfig;        delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'xp-balloon';       cfg: XpBalloonConfig;       delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'geocities-alert';  cfg: GeoAimAlertConfig;     delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'buffering';        cfg: BufferingConfig;       delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'winamp-skip';      cfg: WinampSkipConfig;      delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'email-alert';      cfg: EmailAlertConfig;      delay?: number; sfx?: string; chain?: EffectChain }
  // ── Anime ─────────────────────────────────────────────────────
  | { type: 'speed-lines';      cfg: SpeedLinesConfig;      delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'impact-frame';     cfg: ImpactFrameConfig;     delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'power-up-aura';    cfg: PowerUpAuraConfig;     delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'to-be-continued';  cfg: ToBeContinuedConfig;   delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'screentone-wipe';  cfg: ScreentoneWipeConfig;  delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'sweat-drop';       cfg: SweatDropConfig;       delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'dramatic-zoom';    cfg: DramaticZoomConfig;    delay?: number; sfx?: string; chain?: EffectChain }
  // ── MMORPG / Retro-Futurist ──────────────────────────────────────
  | { type: 'item-pickup';      cfg: ItemPickupConfig;      delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'quest-complete';   cfg: QuestCompleteConfig;   delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'critical-hit';     cfg: CriticalHitConfig;     delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'boss-warning';     cfg: BossWarningConfig;     delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'combo-multiplier'; cfg: ComboMultiplierConfig; delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'game-over-effect'; cfg: GameOverEffectConfig;  delay?: number; sfx?: string; chain?: EffectChain }
  | { type: 'matrix-glitch';    cfg: MatrixGlitchConfig;    delay?: number; sfx?: string; chain?: EffectChain }

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

// ── Overlay trigger payload (admin → server → overlay) ──────────

/** Full payload for overlay:trigger / overlay:show.
 *  effects is an ordered array; each fires with its optional delay. */
export interface OverlayTriggerPayload {
  id: string
  effects: EffectConfig[]
}
