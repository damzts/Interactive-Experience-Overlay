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

/** Whether an application launches a fullscreen Scene or a stacking Widget window */
export type ApplicationType = 'scene' | 'widget'

/** A desktop application icon that launches a scene or opens a widget */
export interface Application {
  id: string
  label: string
  icon: string
  /** 'scene' = fullscreen (replaces display), 'widget' = stacking Win98 window on Desktop */
  appType: ApplicationType
  targetSceneId: string
  /** @deprecated Use introTransition / exitTransition */
  transitionType: string
  /** Transition played when entering this app (desktop → app). Overrides TRANSITION_TYPE map. */
  introTransition?: string
  /** Transition played when leaving this app back to desktop (app → desktop). */
  exitTransition?: string
  /** Absolute pixel position of the icon on the 1920×1080 desktop canvas */
  iconPosition?: { x: number; y: number }
  /** Visual size of the desktop icon */
  iconSize?: 'small' | 'normal' | 'large'
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

/** Win98-specific desktop OS configuration */
export interface DesktopConfig {
  /** Icon size applied to all icons when no per-app iconSize is set */
  defaultIconSize: 'small' | 'normal' | 'large'
  /** When true: icons snap to auto-column; when false: icons use absolute iconPosition */
  autoArrangeIcons: boolean
  /** Screen saver settings */
  screenSaver: {
    enabled: boolean
    /** Minutes of idle before activating */
    timeoutMinutes: number
    /** Animation preset */
    preset: 'flying-windows' | 'starfield' | 'marquee' | 'pipes' | 'blank'
  }
  /** System sound SFX file paths (relative to ieom/assets/sfx/system/) */
  systemSounds: {
    startup: string
    error: string
    notify: string
    click: string
    close: string
  }
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
  desktopConfig?: DesktopConfig
}
