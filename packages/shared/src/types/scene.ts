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
export type DesktopIconAnimation = 'none' | 'pulse' | 'float' | 'jiggle' | 'drift' | 'orbit' | 'breathe' | 'reactive'
export type DesktopIconArrangement = 'grid' | 'wave' | 'ripple' | 'spiral' | 'scatter' | 'orbit'
export type WidgetSkinTheme = 'metalheart' | 'genx soft club' | 'chromecore' | 'y2k futurism' | 'transparent' | 'aqua pop' | 'mallsoft pearl' | 'messenger glow' | 'limewire plasma' | 'cyber y2k' | 'digital futurism' | 'ssx rush' | 'ps2 drift' | 'xbox blade' | 'cel street' | 'aero nova' | 'aero opaline' | 'dial-up candy' | 'webcore flash' | 'lan party'
export type WidgetThemeAnimation = 'steady' | 'pulse' | 'shimmer' | 'aurora' | 'broadcast'
export type WidgetThemeAtmosphere = 'clean' | 'sparkle' | 'scanlines' | 'grid' | 'nebula'
export type EventDesktopTheme = DesktopTheme | 'random'
export type EventWidgetSkinTheme = WidgetSkinTheme | 'random'

export interface WidgetThemeConfig {
  /** Widget chrome preset, similar to classic app skins. */
  skin: WidgetSkinTheme
  /** Google Font name, or 'default'. */
  fontFamily: string
  /** Accent/tint used to push the selected skin. */
  accentColor: string
  /** Main widget text color. */
  textColor: string
  /** Continuous animation profile applied to widget chrome and panels. */
  animation: WidgetThemeAnimation
  /** Decorative texture layer living above the skin. */
  atmosphere: WidgetThemeAtmosphere
  /** 0-3 scalar controlling how active skin motion appears. */
  motionIntensity: number
  /** 0-3 scalar controlling bloom, glow, and accent light. */
  glowIntensity: number
  /** 0-1 opacity of the widget shell chrome. 1 = fully opaque. */
  shellOpacity: number
  /** 0-3 scalar for the drop shadow behind each widget window. */
  shadowIntensity: number
  /** 0-16 border radius in px applied to the window chrome corners. */
  borderRadius: number
  /** Override for the title bar gradient start color. Empty string = skin default. */
  titleColor: string
}

export type EventWidgetThemePatch = Partial<Omit<WidgetThemeConfig, 'skin'>> & {
  skin?: EventWidgetSkinTheme
}

export interface GlobalThemeDefaultConfig {
  theme: DesktopTheme
  widgetTheme: WidgetThemeConfig
  appearance: {
    fontFamily: string
    accentColor: string
    textColor: string
  }
}

export interface WidgetWindowSize {
  /** Width in pixels for the widget window chrome. */
  width?: number
  /** Height in pixels for the widget window chrome. */
  height?: number
}

export interface WidgetLayoutItem {
  /** Widget application id, e.g. 'music' or 'camera-2'. */
  widgetId: string
  /** Whether the widget should be open after the layout is applied. */
  enabled: boolean
  /** Absolute pixel position for the widget window. */
  x: number
  y: number
  /** Absolute widget window size. */
  width: number
  height: number
  /** Higher values seed the widget nearer the front when the layout is applied. */
  focusPriority: number
}

export interface WidgetLayoutSnapshot {
  label: string
  icon: string
  description?: string
  items: WidgetLayoutItem[]
}

export type WidgetLayoutSource = 'system' | 'user'

export interface WidgetLayoutDefinition {
  id: string
  label: string
  icon: string
  source: WidgetLayoutSource
  description?: string
  items: WidgetLayoutItem[]
  defaultConfig?: WidgetLayoutSnapshot
}

export type WidgetComponentType = 'archive' | 'camera' | 'chat' | 'gallery' | 'music' | 'source' | 'sticky-notes' | 'spectrum-analyzer' | 'equalizer-rack' | 'wave-scope' | 'playlist-deck' | 'net-meter' | 'media-deck' | 'cd-ripper' | 'signal-lab' | 'broadcast-scheduler' | 'weather-console' | 'clock-tower' | 'newswire-desk' | 'city-navigator' | 'lcd-dolphins' | 'generic'

export interface SourceWidgetSettings {
  sceneId?: string
  sourceId?: string
}

export interface StickyNotesSettings {
  text: string
  color: string
}

export interface RecycleBinSettings {
  emptyIcon: string
  fullIcon: string
}

export interface ApplicationDefaultSnapshot {
  id: string
  label: string
  icon: string
  appType: ApplicationType
  targetSceneId: string
  widgetSource?: WidgetLayoutSource
  widgetComponent?: WidgetComponentType
  transitionType?: string
  introTransition?: string
  exitTransition?: string
  introTransitions?: TransitionStep[]
  exitTransitions?: TransitionStep[]
  iconPosition?: { x: number; y: number }
  iconSize?: 'small' | 'normal' | 'large'
  launchPipeline?: {
    effects: EffectConfig[]
    delayMs: number
  }
  gallerySettings?: {
    randomOrder?: boolean
    autoPlay?: boolean
    intervalSec?: number
  }
  cameraSettings?: {
    preferredDeviceLabel?: string
    mirror?: boolean
  }
  sourceWidgetSettings?: SourceWidgetSettings
  stickyNotesSettings?: StickyNotesSettings
  recycleBinSettings?: RecycleBinSettings
  widgetDefaults?: {
    windowPosition?: { x: number; y: number }
    windowSize?: WidgetWindowSize
    defaultZIndex?: number
    themeOverride?: WidgetThemeConfig
  }
}

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

/** A desktop application icon that launches a scene or opens a widget */
export interface Application {
  id: string
  label: string
  /** Emoji glyph or image URL/path from the asset library. */
  icon: string
  /** 'scene' = fullscreen (replaces display), 'widget' = stacking window, 'decoration' = desktop-only icon */
  appType: ApplicationType
  targetSceneId: string
  /** Distinguishes built-in widgets from user-created widget records. */
  widgetSource?: WidgetLayoutSource
  /** Runtime base component used by widget windows. */
  widgetComponent?: WidgetComponentType
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
  /** Optional per-widget settings for the gallery widget runtime behavior. */
  gallerySettings?: {
    /** If true, automatic and play-step progression picks random images. */
    randomOrder?: boolean
    /** If true, gallery advances automatically by intervalSec. */
    autoPlay?: boolean
    /** Auto-play interval in seconds. */
    intervalSec?: number
  }
  /** Optional per-widget defaults for camera widget runtime behavior. */
  cameraSettings?: {
    /** Preferred camera device label (or partial label) used as fallback default for this widget. */
    preferredDeviceLabel?: string
    /** Mirror the video horizontally. Default: false. */
    mirror?: boolean
  }
  /** Optional source binding for source-backed widget windows. */
  sourceWidgetSettings?: SourceWidgetSettings
  /** Optional persisted content for the Sticky Notes system widget. */
  stickyNotesSettings?: StickyNotesSettings
  /** Optional icon assets for the Recycle Bin decoration app. */
  recycleBinSettings?: RecycleBinSettings
  /** Persisted widget chrome override for this specific widget. Overrides globalThemeDefault.widgetTheme when set. */
  themeOverride?: WidgetThemeConfig
  /** Persisted factory snapshot used to restore this application/widget to defaults. */
  defaultConfig?: ApplicationDefaultSnapshot
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
  /** Persisted factory snapshot used to restore this scene to defaults. */
  defaultConfig?: SceneDefaultSnapshot
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
  /** User-defined default snapshot for the Global Theme utility. Active theme and widget theme are read from here. */
  globalThemeDefault: GlobalThemeDefaultConfig
  /** Runtime-only per-widget chrome overrides, keyed by widget id. Written by events; never persisted to DB. */
  widgetThemeOverrides?: Record<string, WidgetThemeConfig>
  /** Icon size applied to all icons when no per-app iconSize is set */
  defaultIconSize: 'small' | 'normal' | 'large'
  /** When true: icons snap to auto-column; when false: icons use absolute iconPosition */
  autoArrangeIcons: boolean
  /** Ambient motion profile used by desktop icons */
  iconAnimation: DesktopIconAnimation
  /** Dynamic positional arrangement — moves icons across the screen over time */
  iconArrangement: DesktopIconArrangement
  /** 0-3 scalar controlling how strong icon motion appears (1 = 100%) */
  iconMotion: number
  /** 0-3 scalar controlling the speed/spread of the dynamic icon arrangement (1 = 100%) */
  iconArrangementMotion: number
  /** Persisted widget window positions, keyed by widget id (e.g. 'music', 'archive') */
  widgetPositions?: Record<string, { x: number; y: number }>
  /** Optional per-widget window size overrides, keyed by widget id. */
  widgetSizes?: Record<string, WidgetWindowSize>
  /** Default widget stack order, keyed by widget id. Higher value = preferred front-most baseline. */
  widgetDefaultZIndices?: Record<string, number>
  /** Persisted current widget window z-index order, keyed by widget id. Higher value = rendered on top. */
  widgetZIndices?: Record<string, number>
  /** Saved named widget layout presets for the desktop runtime. */
  widgetLayouts?: WidgetLayoutDefinition[]
  /** Runtime state for the recycle bin decoration app */
  recycleBin: {
    fullOnStart: boolean
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
import type { STATE } from './state.js'

/** Auto-trigger configuration for an event */
export interface AutoTrigger {
  enabled: boolean
  mode: 'interval' | 'idle'
  /** Fire roughly every N minutes (mode: interval) */
  intervalMin: number
  /** Fire after N minutes of idle (mode: idle) */
  idleMin: number
  /** 0-1 chance applied when the event becomes eligible. */
  chance: number
  /** Minimum delay before the same event can fire again. */
  cooldownMin: number
  /** Optional scene whitelist. Empty = any state. */
  allowedStates?: STATE[]
}

export interface EventDesktopConfigAction {
  kind: 'desktop-config'
  timeoutSeconds?: number
  patch: {
    theme?: EventDesktopTheme
    iconAnimation?: DesktopIconAnimation
    iconMotion?: number
    widgetTheme?: EventWidgetThemePatch
    screenSaver?: Partial<DesktopConfig['screenSaver']>
  }
}

export interface EventWidgetThemeOverridesAction {
  kind: 'widget-theme-overrides'
  timeoutSeconds?: number
  widgetIds: string[]
  clearExisting?: boolean
  theme: EventWidgetThemePatch
}

export interface EventWidgetLayoutAction {
  kind: 'widget-layout'
  layoutId: string
  timeoutSeconds?: number
}

export interface EventWidgetCommandAction {
  kind: 'widget-command'
  widgetId: string
  action: 'open' | 'close' | 'toggle'
}

export interface EventAmbiancePatchAction {
  kind: 'ambiance-patch'
  timeoutSeconds?: number
  patch: Partial<AmbianceWidgetSimulationConfig>
}

export type EventAction =
  | EventDesktopConfigAction
  | EventWidgetThemeOverridesAction
  | EventWidgetLayoutAction
  | EventWidgetCommandAction
  | EventAmbiancePatchAction

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
  /** Runtime actions executed alongside overlay effects. */
  actions?: EventAction[]
  auto: AutoTrigger
}

// ── Desktop Ambiance (AI Simulation) ────────────────────────────

export interface AmbianceWidgetBehavior {
  /** Is this widget included in the ambiance simulation? */
  enabled: boolean
  /** Chance (0-1) to open this widget if it's closed during a tick. */
  openChance: number
  /** Chance (0-1) to close this widget if it's open during a tick. */
  closeChance: number
  /** Chance (0-1) to interact with this widget while open. Falls back to recipe default when omitted. */
  interactChance?: number
}

export interface AmbianceWidgetSimulationConfig {
  /** Is the widget simulation active? */
  enabled: boolean
  /** How often (in seconds) the manager should evaluate actions. */
  intervalSeconds: number
  /** Maximum number of simultaneously open widgets the simulator can keep. */
  maxOpenWidgets?: number
  /** When exactly one widget is open, chance (0-1) to open a second one instead of interacting/closing. */
  openWhileOneOpenChance?: number
  /**
   * Per-widget behavior overrides. If a widget's ID is not in this map,
   * it won't be part of the simulation.
   */
  behaviors: Record<string, AmbianceWidgetBehavior>
}

export interface DesktopAmbianceConfig {
  widgetSimulation: AmbianceWidgetSimulationConfig
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
  desktopAmbiance?: DesktopAmbianceConfig
  /** Saved event definitions. Falls back to DEFAULT_CONFIG.events if absent. */
  events?: EventConfig[]
  /** Centralised media asset library (images / videos) used by TransitionPicker. */
  mediaLibrary?: MediaEntry[]
  /** Reusable source presets referenced by scenes and source widgets. */
  sourcePresets?: SourcePreset[]
}
