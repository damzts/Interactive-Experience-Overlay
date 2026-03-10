export enum STATE {
  /** 3D room (R3F) — the environment containing the PC. Camera looking at the monitor. */
  LOBBY = 'LOBBY',
  /** Win98 OS desktop — flat 2D layer, icons + taskbar. The PC screen, full-screen. */
  DESKTOP = 'DESKTOP',
  TRANSITIONING = 'TRANSITIONING',
}

export enum OVERLAY_EVENT {
  DEATH = 'death',
  VICTORY = 'victory',
  REVIVE = 'revive',
  NETWORK_GLITCH = 'network_glitch',
}

/** Navigable states — all non-transient states. */
export const NAVIGABLE_STATES: STATE[] = [
  STATE.LOBBY,
  STATE.DESKTOP,
]

/** Maps a from→to pair to the named GSAP transition animation.
 *  Pairs not listed here get an instant snap (no animation). */
export const TRANSITION_TYPE: Record<string, string> = {
  [`${STATE.LOBBY}->${STATE.DESKTOP}`]:  'lobby-to-desktop',
  [`${STATE.DESKTOP}->${STATE.LOBBY}`]:  'desktop-to-lobby',
}
