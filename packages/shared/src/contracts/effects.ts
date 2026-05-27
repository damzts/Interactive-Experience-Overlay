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

// ── Discriminated union ─────────────────────────────────────────
// delay?: seconds before this effect fires within the stack (default 0)

export type EffectConfig =
  | { type: 'desktop-notification'; cfg: DesktopNotificationEffectConfig; delay?: number }
  | { type: 'notification-box'; cfg: NotificationBoxConfig; delay?: number }
  | { type: 'terminal-toast';   cfg: TerminalToastConfig;   delay?: number }
  | { type: 'floaties';         cfg: FloatiesConfig;        delay?: number }
  | { type: 'corruption-burst'; cfg: CorruptionBurstConfig; delay?: number }
  | { type: 'network-glitch';   cfg: NetworkGlitchConfig;   delay?: number }
  | { type: 'vignette-pulse';   cfg: VignettePulseConfig;   delay?: number }
  | { type: 'screen-shake';     cfg: ScreenShakeConfig;     delay?: number }
  | { type: 'typewriter';       cfg: TypewriterConfig;      delay?: number }
  | { type: 'static-burst';     cfg: StaticBurstConfig;     delay?: number }
  | { type: 'image-overlay';    cfg: ImageOverlayConfig;    delay?: number }
  | { type: 'video-overlay';    cfg: VideoOverlayConfig;    delay?: number }
  | { type: 'death-overlay';    cfg: DeathOverlayConfig;    delay?: number }
  | { type: 'victory-overlay';  cfg: VictoryOverlayConfig;  delay?: number }
  | { type: 'revive-overlay';   cfg: ReviveOverlayConfig;   delay?: number }

// ── Overlay trigger payload (admin → server → overlay) ──────────

/** Full payload for overlay:trigger / overlay:show.
 *  effects is an ordered array; each fires with its optional delay. */
export interface OverlayTriggerPayload {
  id: string
  effects: EffectConfig[]
}
