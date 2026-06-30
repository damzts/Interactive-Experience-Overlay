/** ── Effect types ─────────────────────────────────────────────────
 *  Every event has an EffectConfig[] — a stack of zero or more effects
 *  that fire together (each with an optional delay).
 *  All events are uniform: no "built-in" vs custom distinction.
 */

export type EffectType =
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
  sfxId: 'startup' | 'transition' | 'death' | 'victory' | 'revive' | 'glitch' | 'custom'
  /** Required when sfxId is 'custom' */
  customUrl?: string
  /** 0–1 volume multiplier, default 1 */
  volume?: number
}

// ── Discriminated union ─────────────────────────────────────────
// delay?: seconds before this effect fires within the stack (default 0)

export type EffectConfig =
  | { type: 'desktop-notification'; cfg: DesktopNotificationEffectConfig; delay?: number; sfx?: string }
  | { type: 'notification-box'; cfg: NotificationBoxConfig; delay?: number; sfx?: string }
  | { type: 'terminal-toast';   cfg: TerminalToastConfig;   delay?: number; sfx?: string }
  | { type: 'floaties';         cfg: FloatiesConfig;        delay?: number; sfx?: string }
  | { type: 'corruption-burst'; cfg: CorruptionBurstConfig; delay?: number; sfx?: string }
  | { type: 'network-glitch';   cfg: NetworkGlitchConfig;   delay?: number; sfx?: string }
  | { type: 'vignette-pulse';   cfg: VignettePulseConfig;   delay?: number; sfx?: string }
  | { type: 'screen-shake';     cfg: ScreenShakeConfig;     delay?: number; sfx?: string }
  | { type: 'typewriter';       cfg: TypewriterConfig;      delay?: number; sfx?: string }
  | { type: 'static-burst';     cfg: StaticBurstConfig;     delay?: number; sfx?: string }
  | { type: 'image-overlay';    cfg: ImageOverlayConfig;    delay?: number; sfx?: string }
  | { type: 'video-overlay';    cfg: VideoOverlayConfig;    delay?: number; sfx?: string }
  | { type: 'death-overlay';    cfg: DeathOverlayConfig;    delay?: number; sfx?: string }
  | { type: 'victory-overlay';  cfg: VictoryOverlayConfig;  delay?: number; sfx?: string }
  | { type: 'revive-overlay';   cfg: ReviveOverlayConfig;   delay?: number; sfx?: string }
  | { type: 'achievement-unlock'; cfg: AchievementUnlockConfig; delay?: number; sfx?: string }
  | { type: 'system-alert';     cfg: SystemAlertConfig;     delay?: number; sfx?: string }
  | { type: 'error-dialog';     cfg: ErrorDialogConfig;     delay?: number; sfx?: string }
  | { type: 'friend-join';      cfg: FriendJoinConfig;      delay?: number; sfx?: string }
  | { type: 'vhs-glitch';       cfg: VhsGlitchConfig;       delay?: number; sfx?: string }
  | { type: 'scan-lines-sweep'; cfg: ScanLinesSweepConfig;  delay?: number; sfx?: string }
  | { type: 'neon-glow';        cfg: NeonGlowConfig;        delay?: number; sfx?: string }
  | { type: 'chromatic-aberration'; cfg: ChromaticAberrationConfig; delay?: number; sfx?: string }
  | { type: 'film-burn';        cfg: FilmBurnConfig;        delay?: number; sfx?: string }
  | { type: 'tv-off';           cfg: TvOffConfig;           delay?: number; sfx?: string }
  | { type: 'blue-screen';      cfg: BlueScreenConfig;      delay?: number; sfx?: string }
  | { type: 'pixel-transition'; cfg: PixelTransitionConfig; delay?: number; sfx?: string }
  | { type: 'dial-up-connect';  cfg: DialUpConnectConfig;   delay?: number; sfx?: string }
  | { type: 'confetti-burst';   cfg: ConfettiBurstConfig;   delay?: number; sfx?: string }
  | { type: 'xp-gain';          cfg: XpGainConfig;          delay?: number; sfx?: string }
  | { type: 'fireworks';        cfg: FireworksConfig;       delay?: number; sfx?: string }
  | { type: 'dvd-bounce';       cfg: DvdBounceConfig;       delay?: number; sfx?: string }
  | { type: 'level-up';         cfg: LevelUpConfig;         delay?: number; sfx?: string }
  | { type: 'audio-sfx';        cfg: AudioSfxConfig;        delay?: number; sfx?: string }

// ── Overlay trigger payload (admin → server → overlay) ──────────

/** Full payload for overlay:trigger / overlay:show.
 *  effects is an ordered array; each fires with its optional delay. */
export interface OverlayTriggerPayload {
  id: string
  effects: EffectConfig[]
}
