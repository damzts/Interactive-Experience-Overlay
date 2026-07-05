/**
 * Scene identity — data-driven.
 *
 * A scene is identified by a string id from the scenes table. LOBBY and
 * DESKTOP are the two built-in scene ids (seeded rows); user-created
 * scenes are equal citizens — SceneMachine transitions to any id, and
 * automation rules can gate on any id via `sceneIs`.
 *
 * STATE is kept as a const object (formerly an enum) so `STATE.DESKTOP`
 * call sites keep working; the type is now `string`.
 */

export const STATE = {
  /** 3D room (R3F) — the environment containing the PC. Camera looking at the monitor. */
  LOBBY: 'LOBBY',
  /** Win98 OS desktop — flat 2D layer, icons + taskbar. The PC screen, full-screen. */
  DESKTOP: 'DESKTOP',
  /** Machine phase while a transition pipeline plays — not a navigable scene. */
  TRANSITIONING: 'TRANSITIONING',
} as const

export type STATE = string

/** Alias for readability in new code — scene identity is a string id. */
export type SceneId = string

export enum OVERLAY_EVENT {
  DEATH = 'death',
  VICTORY = 'victory',
  REVIVE = 'revive',
  NETWORK_GLITCH = 'network_glitch',
}

/** Built-in navigable scene ids. User-created scenes extend this at
 *  runtime via config.scenes — UI pickers should merge both. */
export const NAVIGABLE_STATES: STATE[] = [
  STATE.LOBBY,
  STATE.DESKTOP,
]

/** Maps a from→to pair to the named GSAP transition animation.
 *  Pairs not listed here get an instant snap (no animation). */
export const TRANSITION_TYPE: Record<string, string> = {
}
