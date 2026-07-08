import type { Rect } from './geometry.js'
import type { OverlayStyle } from './overlay.js'

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

// ── Lobby 3D environment ─────────────────────────────────────────

/** Configurable 3D environment for the Lobby scene */
export interface LobbyConfig {
  ambientColor: string
  ambientIntensity: number
  fogColor: string
  fogNear: number
  fogFar: number
  skyTopColor: string
  skyHorizonColor: string
  floorColor: string
  floorReflectivity: number
  crtGlowColor: string
  dustMotes: boolean
  cameraFov: number
  starsCount: number
  virtualPet: {
    enabled: boolean
    color: string
    accessoryColor: string
  }
  lavaLamp: {
    enabled: boolean
    glassColor: string
    liquidColor: string
    glowColor: string
  }
  fishTank: {
    enabled: boolean
    glassColor: string
    waterColor: string
    fishColor: string
    fishCount: number
  }
  /** @deprecated legacy flat-sky migration field */
  skyColor?: string
}

// ── Scene snapshot ───────────────────────────────────────────────

export interface SceneDefaultSnapshot {
  label: string
  backgroundOpaque: boolean
  windows: WindowInstance[]
  style?: OverlayStyle
  lobbyConfig?: LobbyConfig
  introSequenceId?: string
  exitSequenceId?: string
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
  /** Visual style: background, particles, typography. Effects are now explicit windows. */
  style?: OverlayStyle
  /** 3D room configuration. Used by LOBBY scene. */
  lobbyConfig?: LobbyConfig
  /** Sequence to play when entering this scene. */
  introSequenceId?: string
  /** Sequence to play when leaving this scene. */
  exitSequenceId?: string
  /** Independent ambient audio track URL (crowd noise, room tone, etc.).
   *  Persists across scene changes — only replaced when ambientTrack itself changes. */
  ambientTrack?: string
  /** Show the Win98 desktop layer while this scene is active. Default: false */
  showDesktop?: boolean
  /** Persisted factory snapshot used to restore this scene to defaults. */
  defaultConfig?: SceneDefaultSnapshot
}
