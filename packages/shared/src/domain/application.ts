import type { Rect } from './geometry.js'

// ── Widget types ─────────────────────────────────────────────────

export type WidgetLayoutSource = 'system' | 'user'

export type WidgetComponentType =
  | 'archive' | 'camera' | 'chat' | 'gallery' | 'music' | 'window'
  | 'sticky-notes' | 'spectrum-analyzer' | 'equalizer-rack' | 'wave-scope'
  | 'playlist-deck' | 'net-meter' | 'media-deck' | 'cd-ripper' | 'signal-lab'
  | 'broadcast-scheduler' | 'weather-console' | 'clock-tower' | 'newswire-desk'
  | 'city-navigator' | 'lcd-dolphins' | 'generic'

// ── Widget theme types ────────────────────────────────────────────

export type WidgetSkinTheme =
  | 'metalheart' | 'genx soft club' | 'chromecore' | 'y2k futurism' | 'transparent'
  | 'aqua pop' | 'mallsoft pearl' | 'messenger glow' | 'limewire plasma' | 'cyber y2k'
  | 'digital futurism' | 'ssx rush' | 'ps2 drift' | 'xbox blade' | 'cel street'
  | 'aero nova' | 'aero opaline' | 'dial-up candy' | 'webcore flash' | 'lan party'

export type WidgetThemeAnimation = 'steady' | 'pulse' | 'shimmer' | 'aurora' | 'broadcast'
export type WidgetThemeAtmosphere = 'clean' | 'sparkle' | 'scanlines' | 'grid' | 'nebula'

export type EventWidgetSkinTheme = WidgetSkinTheme | 'random'

export interface WidgetThemeConfig {
  skin: WidgetSkinTheme
  fontFamily: string
  accentColor: string
  textColor: string
  animation: WidgetThemeAnimation
  atmosphere: WidgetThemeAtmosphere
  motionIntensity: number
  glowIntensity: number
  shellOpacity: number
  shadowIntensity: number
  borderRadius: number
  titleColor: string
}

export type EventWidgetThemePatch = Partial<Omit<WidgetThemeConfig, 'skin'>> & {
  skin?: EventWidgetSkinTheme
}

// ── Widget window geometry ────────────────────────────────────────

export interface WidgetWindowSize {
  width?: number
  height?: number
}

export interface WidgetLayoutItem extends Rect {
  widgetId: string
  enabled: boolean
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

export interface WindowWidgetSettings {
  sceneId?: string
  windowId?: string
}

export interface StickyNotesSettings {
  text: string
  color: string
}

// ── Transition asset ──────────────────────────────────────────────

export interface TransitionDefinition {
  id: string
  label: string
  type: string
  params?: Record<string, unknown>
}

// ── Widget entity ─────────────────────────────────────────────────

/** A desktop widget — opens as a stacking window on the Win98 desktop */
export interface Application {
  id: string
  label: string
  /** Emoji glyph or image URL/path from the asset library. */
  icon: string
  /** Distinguishes built-in widgets from user-created widget records. */
  widgetSource?: WidgetLayoutSource
  /** Runtime base component used by widget windows. */
  widgetComponent?: WidgetComponentType
  /** Persisted widget window position on the 1920×1080 desktop canvas */
  windowPosition?: { x: number; y: number }
  /** Persisted widget window size override */
  windowSize?: WidgetWindowSize
  /** Default widget z-index baseline */
  zIndexDefault?: number
  /** Current persisted widget z-index (runtime stack order) */
  zIndexCurrent?: number
  /** Optional per-widget settings for the gallery widget runtime behavior. */
  gallerySettings?: {
    randomOrder?: boolean
    autoPlay?: boolean
    intervalSec?: number
  }
  /** Optional per-widget defaults for camera widget runtime behavior. */
  cameraSettings?: {
    preferredDeviceLabel?: string
    mirror?: boolean
  }
  /** Optional window binding for window-backed widget windows. */
  windowWidgetSettings?: WindowWidgetSettings
  /** Optional persisted content for the Sticky Notes system widget. */
  stickyNotesSettings?: StickyNotesSettings
  /** Persisted widget chrome theme for this specific widget. */
  theme?: WidgetThemeConfig

  // ── Desktop icon fields (used by overlay desktop UI) ──────────────────

  /** Icon size on the desktop grid. */
  iconSize?: 'small' | 'normal' | 'large'
  /** Manual icon position on the desktop canvas (px). */
  iconPosition?: { x: number; y: number }
  /** Recycle bin icon overrides. */
  recycleBinSettings?: RecycleBinSettings
  /** Target scene ID for taskbar scene-switching. */
  targetSceneId?: string
}

/** Desktop icon overrides for the recycle bin widget. */
export type RecycleBinSettings = {
  fullIcon?: string
  emptyIcon?: string
}
