import type { OverlayStyle } from './overlay.js'

// ── Source preset and instance ───────────────────────────────────

export interface SourcePreset {
  id: string
  label: string
  pluginType: string
  config: Record<string, unknown>
  defaultPosition?: { x: number; y: number; width: number; height: number }
}

/** A single source instance within a scene */
export interface SourceInstance {
  id: string
  sourcePresetId?: string
  pluginType?: string
  config?: Record<string, unknown>
  position: { x: number; y: number; width: number; height: number }
  zIndex: number
  visible: boolean
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
 */
export interface TransitionStep {
  id: string
  duration?: number
}

// ── Scene snapshot ───────────────────────────────────────────────

export interface SceneDefaultSnapshot {
  label: string
  backgroundOpaque: boolean
  sources: SourceInstance[]
  style?: OverlayStyle
  lobbyConfig?: LobbyConfig
  introTransitions?: TransitionStep[]
  exitTransitions?: TransitionStep[]
  musicTrack?: string
}

// ── Scene entity ─────────────────────────────────────────────────

/** A scene is an ordered list of source instances */
export interface Scene {
  id: string
  label: string
  backgroundOpaque: boolean
  sources: SourceInstance[]
  /** Visual style: background, effects, particles, typography. */
  style?: OverlayStyle
  /** 3D room configuration. Used by LOBBY scene. */
  lobbyConfig?: LobbyConfig
  /** @deprecated use introTransitions */
  introTransition?: string
  /** @deprecated use exitTransitions */
  exitTransition?: string
  /** Ordered pipeline of transitions played when entering this scene. */
  introTransitions?: TransitionStep[]
  /** Ordered pipeline of transitions played when leaving this scene. */
  exitTransitions?: TransitionStep[]
  /** Background music track URL to play when this scene is active. */
  musicTrack?: string
  /** Persisted factory snapshot used to restore this scene to defaults. */
  defaultConfig?: SceneDefaultSnapshot
}
