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

/** Whether an application launches a fullscreen Scene, opens a widget, or is decorative only. */
export type ApplicationType = 'scene' | 'widget' | 'decoration'

export type DesktopTheme = 'win98' | 'frutiger aero' | 'y2k candy' | 'midnight chrome' | 'sunset boulevard' | 'coastal glass' | 'amber terminal' | 'custom'
export type DesktopIconAnimation = 'none' | 'pulse' | 'float' | 'jiggle' | 'reactive'

/** A desktop application icon that launches a scene or opens a widget */
export interface Application {
  id: string
  label: string
  /** Emoji glyph or image URL/path from the asset library. */
  icon: string
  /** 'scene' = fullscreen (replaces display), 'widget' = stacking window, 'decoration' = desktop-only icon */
  appType: ApplicationType
  targetSceneId: string
  /** @deprecated kept for stored-config migration; use exitTransitions / introTransitions */
  transitionType?: string
  /** @deprecated use introTransitions */
  introTransition?: string
  /** @deprecated use exitTransitions */
  exitTransition?: string
  /** Ordered pipeline played when entering this app. */
  introTransitions?: TransitionStep[]
  /** Ordered pipeline played when leaving this app. */
  exitTransitions?: TransitionStep[]
  /** Absolute pixel position of the icon on the 1920×1080 desktop canvas */
  iconPosition?: { x: number; y: number }
  /** Visual size of the desktop icon */
  iconSize?: 'small' | 'normal' | 'large'
  /** Optional cinematic pipeline played before the scene changes.
   *  Fire effects (e.g. a static burst or OS launch animation), wait delayMs, then change scene. */
  launchPipeline?: {
    effects: EffectConfig[]
    /** Milliseconds to wait after firing effects before emitting scene:change */
    delayMs: number
  }
}

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
  /** Desktop chrome preset: taskbar, title bars, menus, and controls */
  theme: DesktopTheme
  /** Icon size applied to all icons when no per-app iconSize is set */
  defaultIconSize: 'small' | 'normal' | 'large'
  /** When true: icons snap to auto-column; when false: icons use absolute iconPosition */
  autoArrangeIcons: boolean
  /** Ambient motion profile used by desktop icons */
  iconAnimation: DesktopIconAnimation
  /** Persisted widget window positions, keyed by widget id (e.g. 'music', 'archive') */
  widgetPositions?: Record<string, { x: number; y: number }>
  /** Desktop notification renderer settings */
  notifications: {
    enabled: boolean
    defaultDurationMs: number
    maxVisible: number
  }
  /** Visual state for the recycle bin decoration app */
  recycleBin: {
    emptyIcon: string
    fullIcon: string
    fullOnStart: boolean
  }
  /** Persisted content for the sticky notes widget */
  stickyNotes: {
    text: string
    color: string
  }
  /** Screen saver settings */
  screenSaver: {
    enabled: boolean
    /** Minutes of idle before activating */
    timeoutMinutes: number
    /** Animation preset */
    preset: 'flying-windows' | 'starfield' | 'marquee' | 'pipes' | 'blank' | 'gallery-scroll'
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

// ── Media Library ──────────────────────────────────────────────

/** A named media asset saved in the centralised Asset Library */
export interface MediaEntry {
  id: string
  name: string
  type: 'image' | 'video'
  url: string
  /** Display duration in seconds (images only; videos auto-detect) */
  duration?: number
}

// ── Transition pipeline ─────────────────────────────────────────

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

// ── Event config ────────────────────────────────────────────────
// Imported by: admin Dashboard.tsx, shared defaults, server (auto-trigger future)
import type { EffectConfig } from './effects.js'

/** Auto-trigger configuration for an event */
export interface AutoTrigger {
  enabled: boolean
  mode: 'interval' | 'idle'
  /** Fire roughly every N minutes (mode: interval) */
  intervalMin: number
  /** Fire after N minutes of idle (mode: idle) */
  idleMin: number
}

/** A saved event definition — persisted in AppConfig.events */
export interface EventConfig {
  id: string
  label: string
  icon: string
  /** Tailwind text color class, e.g. 'text-red-400' */
  color: string
  desc: string
  /** Ordered stack of effects to fire. Empty = no visual. */
  effects: EffectConfig[]
  auto: AutoTrigger
}

// ── Root config ─────────────────────────────────────────────────

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
  /** Saved event definitions. Falls back to DEFAULT_CONFIG.events if absent. */
  events?: EventConfig[]
  /** Centralised media asset library (images / videos) used by TransitionPicker. */
  mediaLibrary?: MediaEntry[]
}
