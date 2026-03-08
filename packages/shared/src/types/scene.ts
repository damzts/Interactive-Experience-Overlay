/** A single source instance within a scene */
export interface SourceInstance {
  id: string
  pluginType: string
  config: Record<string, unknown>
  position: { x: number; y: number; width: number; height: number }
  zIndex: number
  visible: boolean
}

/** Configurable 3D environment for the Lobby scene */
export interface LobbyConfig {
  ambientColor: string
  ambientIntensity: number
  fogColor: string
  fogNear: number
  fogFar: number
  wallColor: string
  floorColor: string
  floorReflectivity: number
  crtGlowColor: string
  neonStrips: boolean
  neonColors: [string, string]
  dustMotes: boolean
  cameraFov: number
  starsCount: number
}

/** A desktop application icon that launches a scene */
export interface Application {
  id: string
  label: string
  icon: string
  targetSceneId: string
  /** @deprecated Use introTransition / exitTransition */
  transitionType: string
  /** Transition played when entering this app (desktop \u2192 app). Overrides TRANSITION_TYPE map. */
  introTransition?: string
  /** Transition played when leaving this app back to desktop (app \u2192 desktop). */
  exitTransition?: string
}

/** A scene is an ordered list of source instances */
export interface Scene {
  id: string
  label: string
  backgroundOpaque: boolean
  sources: SourceInstance[]
  /** Visual style: background, effects, particles, typography. Used by DESKTOP scene. */
  style?: OverlayStyle
  /** 3D room configuration. Used by LOBBY scene. */
  lobbyConfig?: LobbyConfig
}

/** ── Overlay style system ─────────────────────────────────────── */

export type BackgroundType = 'none' | 'color' | 'gradient' | 'image-url' | 'video-url' | 'pattern'
export type PatternPreset  = 'none' | 'grid' | 'dots' | 'diagonal' | 'honeycomb' | 'circuit' | 'topography'
export type ParticlePreset = 'none' | 'stars' | 'snow' | 'matrix' | 'fireflies' | 'ash'

export interface OverlayBackground {
  type: BackgroundType
  color: string
  gradient: string
  imageUrl: string
  videoUrl: string
  pattern: PatternPreset
  /** 0–1 */
  opacity: number
  /** px */
  blur: number
}

export interface OverlayEffects {
  crt: boolean
  noise: boolean
  vignette: boolean
  flicker: boolean
  chromatic: boolean
  scanlineOpacity: number
  noiseOpacity: number
  vignetteStrength: number
}

export interface OverlayParticles {
  enabled: boolean
  preset: ParticlePreset
  /** 0–1 */
  density: number
  /** 0–1 */
  speed: number
}

export interface OverlayStyle {
  background: OverlayBackground
  effects: OverlayEffects
  particles: OverlayParticles
  /** Google Font name, or 'default' */
  fontFamily: string
  accentColor: string
  textColor: string
}

/** Root application config — stored in server memory (v1) */
export interface AppConfig {
  scenes: Record<string, Scene>
  applications: Application[]
  keybinds: {
    obs: Record<string, string>
    admin: Record<string, string>
  }
  obs: {
    url: string
    password: string
  }
  audio: {
    masterVolume: number
    sfxVolume: number
    musicVolume: number
  }
  overlayStyle: OverlayStyle
}

