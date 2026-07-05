/**
 * PRESENTATION LAYER — Desktop OS
 *
 * Types in this file are specific to the Desktop OS presentation.
 * They are NOT engine primitives. A different overlay client (broadcast deck,
 * minimal HUD, etc.) would not use these types.
 *
 * Engine-level types live in domain/application.ts, domain/scene.ts, etc.
 * New engine work must not import from this file.
 */

import type { WidgetThemeConfig } from './application.js'

// ── Desktop OS theme & motion types ──────────────────────────────

export type DesktopTheme =
  | 'win98' | 'frutiger aero' | 'y2k candy' | 'midnight chrome'
  | 'sunset boulevard' | 'coastal glass' | 'amber terminal' | 'custom'
  | 'diablo' | 'matrix' | 'cyberpunk' | 'runescape'

/** Real, drift-able theme presets — excludes 'custom' (hand-tuned overrides,
 *  not a preset to randomly land on). Server-importable (no admin UI import). */
export const DESKTOP_THEME_IDS: DesktopTheme[] = [
  'win98', 'frutiger aero', 'y2k candy', 'midnight chrome',
  'sunset boulevard', 'coastal glass', 'amber terminal',
  'diablo', 'matrix', 'cyberpunk', 'runescape',
]

export type DesktopIconAnimation =
  | 'none' | 'pulse' | 'float' | 'jiggle' | 'drift' | 'orbit' | 'breathe' | 'reactive'

export const DESKTOP_ICON_ANIMATION_IDS: DesktopIconAnimation[] = [
  'none', 'pulse', 'float', 'jiggle', 'drift', 'orbit', 'breathe', 'reactive',
]

export type DesktopIconArrangement =
  | 'grid' | 'wave' | 'ripple' | 'spiral' | 'scatter' | 'orbit'

export const DESKTOP_ICON_ARRANGEMENT_IDS: DesktopIconArrangement[] = [
  'grid', 'wave', 'ripple', 'spiral', 'scatter', 'orbit',
]

export type EventDesktopTheme = DesktopTheme | 'random'

export interface GlobalThemeDefaultConfig {
  theme: DesktopTheme
  widgetTheme: WidgetThemeConfig
  appearance: {
    fontFamily: string
    accentColor: string
    textColor: string
  }
}

// ── Desktop OS configuration ──────────────────────────────────────

/** Win98-specific desktop OS configuration (OS presentation only — no widget geometry) */
export interface DesktopConfig {
  /** User-defined default snapshot for the Global Theme utility. Active theme and widget theme are read from here. */
  globalThemeDefault: GlobalThemeDefaultConfig
  /** Runtime-only per-widget chrome themes, keyed by widget id. Written by events; never persisted to DB. */
  widgetThemes?: Record<string, WidgetThemeConfig>
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
