// ── POV Switching Domain Types ────────────────────────────────────

/** Switching mode */
export type SwitchMode = 'automatic' | 'manual' | 'round-robin' | 'random'

/** Transition type for camera switches */
export interface TransitionConfig {
  type: 'cut' | 'fade'
  durationMs: number
}
