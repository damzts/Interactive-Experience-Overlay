import type { Rect } from './geometry.js'
import type { OverlayStyle } from './overlay.js'

// ── Source preset and instance ───────────────────────────────────

export interface SourcePreset {
  id: string
  label: string
  pluginType: string
  config: Record<string, unknown>
  defaultPosition?: Rect
}

/** Conditions that gate source visibility locally, without kernel round-trips */
export interface SourceConditions {
  /** Only visible when these widgets are open */
  whenWidgetsOpen?: string[]
  /** Only visible when a specific runtime override key is active */
  whenOverride?: string
  /** Only visible after N seconds in this scene */
  afterSeconds?: number
}

/** A single source instance within a scene */
export interface SourceInstance {
  id: string
  sourcePresetId?: string
  pluginType?: string
  config?: Record<string, unknown>
  position: Rect
  zIndex: number
  visible: boolean
  /** CSS mix-blend-mode for compositing against layers below */
  blendMode?: 'normal' | 'multiply' | 'screen' | 'overlay' | 'add'
  /** ID of another source in the same tier that acts as alpha mask */
  maskSourceId?: string
  /** 0–1 independent of visibility */
  opacity?: number
  /** CSS transition applied when the source appears/disappears */
  transition?: { in: string; out: string; duration: number }
  /** Local visibility conditions evaluated from store state */
  conditions?: SourceConditions
  /** Explicit render tier — overrides the compositor's default 'content' bucket */
  tier?: TierName
}

/** A z-ordered tier of sources within a scene */
export type TierName = 'background' | 'particles' | 'content' | 'post' | 'transition'

export interface SceneTierConfig {
  tier: TierName
  sources: SourceInstance[]
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

// ── Transition pipeline ──────────────────────────────────────────

/**
 * One step in a transition pipeline.
 * `id` is either a GSAP key ('fade', 'zoom-in', …) or a media specifier
 * ('media:video:/assets/video/file.mp4||Name||dur=3').
 * `duration` overrides the animation's built-in speed (seconds).
 * `plugin` spawns an ephemeral plugin renderer in the transition tier instead.
 */
export interface TransitionStep {
  id: string
  duration?: number
  /** Plugin key to spawn as an ephemeral transition source (auto-unmounts after duration) */
  plugin?: string
  pluginConfig?: Record<string, unknown>
}

// ── Scene snapshot ───────────────────────────────────────────────

export interface SceneDefaultSnapshot {
  label: string
  backgroundOpaque: boolean
  sources: SourceInstance[]
  style?: OverlayStyle
  lobbyConfig?: LobbyConfig
  onEntry?: string[]
  onExit?: string[]
  musicTrack?: string
  ambientTrack?: string
}

// ── Media asset entry ────────────────────────────────────────────

/** A named media asset saved in the centralised Asset Library (source_media table) */
export interface MediaEntry {
  id: string
  name: string
  type: 'image' | 'video'
  url: string
  /** Display duration in seconds (images only; videos auto-detect) */
  duration?: number
}

// ── Scene entity ─────────────────────────────────────────────────

/** A scene is an ordered list of source instances */
export interface Scene {
  id: string
  label: string
  backgroundOpaque: boolean
  sources: SourceInstance[]
  /** Visual style: background, particles, typography. Effects are now explicit sources. */
  style?: OverlayStyle
  /** 3D room configuration. Used by LOBBY scene. */
  lobbyConfig?: LobbyConfig
  /** Ordered list of named transition IDs to play when entering this scene. */
  onEntry?: string[]
  /** Ordered list of named transition IDs to play when leaving this scene. */
  onExit?: string[]
  /** Background music track URL to play when this scene is active. */
  musicTrack?: string
  /** Independent ambient audio track URL (crowd noise, room tone, etc.).
   *  Persists across scene musicTrack changes — only replaced when ambientTrack itself changes. */
  ambientTrack?: string
  /** Show the Win98 desktop layer while this scene is active. Default: false */
  showDesktop?: boolean
  /** Persisted factory snapshot used to restore this scene to defaults. */
  defaultConfig?: SceneDefaultSnapshot
}
