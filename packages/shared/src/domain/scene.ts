import type { Rect } from './geometry.js'
import type { OverlayStyle } from './overlay.js'
import type { SequenceStep } from './sequence.js'

// ── Window preset and instance ───────────────────────────────────

export interface WindowPreset {
  id: string
  label: string
  rendererType: string
  config: Record<string, unknown>
  defaultPosition?: Rect
}

/** Conditions that gate window visibility locally, without kernel round-trips */
export interface WindowConditions {
  /** Only visible when these widgets are open */
  whenWidgetsOpen?: string[]
  /** Only visible when a specific runtime override key is active */
  whenOverride?: string
  /** Only visible after N seconds in this scene */
  afterSeconds?: number
}

/** A single window instance within a scene */
export interface WindowInstance {
  id: string
  windowPresetId?: string
  rendererType?: string
  config?: Record<string, unknown>
  position: Rect
  zIndex: number
  visible: boolean
  /** When true, excluded from the admin drag/resize canvas so it stops blocking pointer events for windows beneath it. Editor-only; does not affect runtime rendering. */
  locked?: boolean
  /** CSS mix-blend-mode for compositing against layers below */
  blendMode?: 'normal' | 'multiply' | 'screen' | 'overlay' | 'add'
  /** ID of another window in the same tier that acts as alpha mask */
  maskWindowId?: string
  /** 0–1 independent of visibility */
  opacity?: number
  /** CSS transition applied when the window appears/disappears */
  transition?: { in: string; out: string; duration: number }
  /** Local visibility conditions evaluated from store state */
  conditions?: WindowConditions
  /** Explicit render tier — overrides the compositor's default 'content' bucket */
  tier?: TierName
}

/** A z-ordered tier of windows within a scene */
export type TierName = 'background' | 'particles' | 'content' | 'post' | 'transition'

export interface TierConfig {
  tier: TierName
  windows: WindowInstance[]
}

// ── Scene snapshot ───────────────────────────────────────────────

export interface SceneDefaultSnapshot {
  label: string
  backgroundOpaque: boolean
  windows: WindowInstance[]
  style?: OverlayStyle
  introSequenceId?: string
  exitSequenceId?: string
  /** Scene-specific inline steps, used when introSequenceId is unset. */
  introSteps?: SequenceStep[]
  /** Scene-specific inline steps, used when exitSequenceId is unset. */
  exitSteps?: SequenceStep[]
  ambientTrack?: string
}

// ── Media asset entry ────────────────────────────────────────────

/** A named media entry saved in the Media Library gallery (media_gallery table) */
export interface MediaEntry {
  id: string
  name: string
  type: 'image' | 'video'
  url: string
  /** Display duration in seconds (images only; videos auto-detect) */
  duration?: number
}

// ── Scene entity ─────────────────────────────────────────────────

/** A scene is an ordered list of window instances */
export interface Scene {
  id: string
  label: string
  backgroundOpaque: boolean
  windows: WindowInstance[]
  /** Scene-level typography. Background/effects/particles are explicit windows. */
  style?: OverlayStyle
  /** Sequence to play when entering this scene. */
  introSequenceId?: string
  /** Sequence to play when leaving this scene. */
  exitSequenceId?: string
  /** Scene-specific inline steps to play when entering this scene, authored
   *  directly in Scene Settings rather than as a reusable Sequence. Only
   *  used as a fallback when introSequenceId is unset — an existing
   *  Sequence always takes priority. */
  introSteps?: SequenceStep[]
  /** Scene-specific inline steps to play when leaving this scene. Only
   *  used as a fallback when exitSequenceId is unset. */
  exitSteps?: SequenceStep[]
  /** Independent ambient audio track URL (crowd noise, room tone, etc.).
   *  Persists across scene changes — only replaced when ambientTrack itself changes. */
  ambientTrack?: string
  /** Show the Win98 desktop layer while this scene is active. Default: false */
  showDesktop?: boolean
  /** Persisted factory snapshot used to restore this scene to defaults. */
  defaultConfig?: SceneDefaultSnapshot
}
