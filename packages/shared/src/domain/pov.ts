// ── POV Switching Domain Types ────────────────────────────────────

/** Switching mode: automatic (audio-driven) or manual (host-selected) */
export type SwitchMode = 'automatic' | 'manual'

/** Transition type for camera switches */
export interface TransitionConfig {
  type: 'cut' | 'fade'
  durationMs: number
}
