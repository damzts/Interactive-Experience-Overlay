import type { EffectConfig } from '../contracts/effects.js'
import type { TransitionStep } from './scene.js'

// ── Application types ────────────────────────────────────────────

/** Whether an application launches a fullscreen Scene, opens a widget, or is decorative only. */
export type ApplicationType = 'scene' | 'widget' | 'decoration'

export type WidgetLayoutSource = 'system' | 'user'

export type WidgetComponentType =
  | 'archive' | 'camera' | 'chat' | 'gallery' | 'music' | 'source'
  | 'sticky-notes' | 'spectrum-analyzer' | 'equalizer-rack' | 'wave-scope'
  | 'playlist-deck' | 'net-meter' | 'media-deck' | 'cd-ripper' | 'signal-lab'
  | 'broadcast-scheduler' | 'weather-console' | 'clock-tower' | 'newswire-desk'
  | 'city-navigator' | 'lcd-dolphins' | 'generic'

// ── Desktop & widget theme types ─────────────────────────────────

export type DesktopTheme =
  | 'win98' | 'frutiger aero' | 'y2k candy' | 'midnight chrome'
  | 'sunset boulevard' | 'coastal glass' | 'amber terminal' | 'custom'

export type DesktopIconAnimation =
  | 'none' | 'pulse' | 'float' | 'jiggle' | 'drift' | 'orbit' | 'breathe' | 'reactive'

export type DesktopIconArrangement =
  | 'grid' | 'wave' | 'ripple' | 'spiral' | 'scatter' | 'orbit'

export type WidgetSkinTheme =
  | 'metalheart' | 'genx soft club' | 'chromecore' | 'y2k futurism' | 'transparent'
  | 'aqua pop' | 'mallsoft pearl' | 'messenger glow' | 'limewire plasma' | 'cyber y2k'
  | 'digital futurism' | 'ssx rush' | 'ps2 drift' | 'xbox blade' | 'cel street'
  | 'aero nova' | 'aero opaline' | 'dial-up candy' | 'webcore flash' | 'lan party'

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

// ── Widget window geometry ────────────────────────────────────────

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

export interface WidgetLayoutDefinition {
  id: string
  label: string
  icon: string
  source: WidgetLayoutSource
  description?: string
  items: WidgetLayoutItem[]
  defaultConfig?: WidgetLayoutSnapshot
}

// ── Widget-specific settings ─────────────────────────────────────

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

// ── Application entity ────────────────────────────────────────────

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
