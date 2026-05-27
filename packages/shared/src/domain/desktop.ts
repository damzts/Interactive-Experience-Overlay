import type {
  DesktopIconAnimation,
  DesktopIconArrangement,
  GlobalThemeDefaultConfig,
  WidgetThemeConfig,
  WidgetWindowSize,
  WidgetLayoutDefinition,
} from './application.js'

// ── Desktop OS configuration ──────────────────────────────────────

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
