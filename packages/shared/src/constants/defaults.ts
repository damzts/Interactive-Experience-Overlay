import type {
  Application,
  EventWidgetThemePatch,
  WindowWidgetSettings,
  StickyNotesSettings,
  WidgetThemeAnimation,
  WidgetThemeAtmosphere,
  WidgetThemeConfig,
  WidgetShape,
  WidgetSkinTheme,
  WidgetComponentType,
  WidgetLayoutDefinition,
  WidgetLayoutItem,
  WidgetLayoutSnapshot,
  WidgetLayoutSource,
} from '../domain/application.js'
import { WIDGET_DEFINITIONS } from '../widgets/index.js'
import type { DesktopAmbianceConfig } from '../domain/ambiance.js'
import type { DesktopThemeDriftConfig } from '../domain/themeDrift.js'
import type { AppConfig } from '../domain/config.js'
import type { DesktopConfig, DesktopTheme, EventDesktopTheme } from '../domain/desktop.js'
import type { AutoTrigger, EventAction, EventConfig } from '../domain/event.js'
import type { LobbyConfig, WindowInstance, WindowPreset } from '../domain/scene.js'
import type { OverlayStyle } from '../domain/overlay.js'
import type { RuntimeConfig } from '../contracts/socket.js'
import { STATE, OVERLAY_EVENT } from '../contracts/state.js'

export const DEFAULT_LOBBY_CONFIG: LobbyConfig = {
  ambientColor: '#f8fbff',
  ambientIntensity: 0.85,
  fogColor: '#edf3ff',
  fogNear: 10,
  fogFar: 30,
  skyTopColor: '#dceeff',
  skyHorizonColor: '#f8fbff',
  floorColor: '#eef2f9',
  floorReflectivity: 0.28,
  crtGlowColor: '#6cb6ff',
  dustMotes: true,
  cameraFov: 56,
  starsCount: 0,
  virtualPet: {
    enabled: true,
    color: '#7fd0ff',
    accessoryColor: '#ffe27a',
  },
  lavaLamp: {
    enabled: true,
    glassColor: '#eff6ff',
    liquidColor: '#7ec8ff',
    glowColor: '#9be7ff',
  },
  fishTank: {
    enabled: true,
    glassColor: '#e9f7ff',
    waterColor: '#dcf6ff',
    fishColor: '#ffb347',
    fishCount: 4,
  },
}

function normalizeDesktopTheme(theme?: DesktopTheme | 'win vista'): DesktopTheme {
  if (theme === 'win vista') return 'frutiger aero'
  if (
    theme === 'y2k candy'
    || theme === 'midnight chrome'
    || theme === 'frutiger aero'
    || theme === 'sunset boulevard'
    || theme === 'coastal glass'
    || theme === 'amber terminal'
    || theme === 'custom'
    || theme === 'diablo'
    || theme === 'matrix'
    || theme === 'cyberpunk'
    || theme === 'runescape'
  ) {
    return theme
  }
  return 'win98'
}

function normalizeWidgetSkinTheme(theme?: WidgetSkinTheme): WidgetSkinTheme {
  if (
    theme === 'metalheart'
    || theme === 'genx soft club'
    || theme === 'chromecore'
    || theme === 'y2k futurism'
    || theme === 'transparent'
    || theme === 'aqua pop'
    || theme === 'mallsoft pearl'
    || theme === 'messenger glow'
    || theme === 'limewire plasma'
    || theme === 'cyber y2k'
    || theme === 'digital futurism'
    || theme === 'ssx rush'
    || theme === 'ps2 drift'
    || theme === 'xbox blade'
    || theme === 'cel street'
    || theme === 'aero nova'
    || theme === 'aero opaline'
    || theme === 'dial-up candy'
    || theme === 'webcore flash'
    || theme === 'lan party'
  ) {
    return theme
  }
  return 'metalheart'
}

function clampUnitInterval(value: number | undefined, fallback: number) {
  if (!Number.isFinite(value)) return fallback
  return Math.max(0, Math.min(1, value ?? fallback))
}

function normalizeAllowedStates(states?: AutoTrigger['allowedStates']) {
  if (!Array.isArray(states) || states.length === 0) return undefined

  // Scene ids are data-driven — any non-empty string except the
  // TRANSITIONING machine phase is a valid scene gate.
  const normalized = states.filter(
    (state): state is STATE => typeof state === 'string' && state.length > 0 && state !== STATE.TRANSITIONING,
  )
  return normalized.length ? normalized : undefined
}

function normalizeSourcePosition(position?: WindowInstance['position'] | WindowPreset['defaultPosition']) {
  return {
    x: Math.round(position?.x ?? 0),
    y: Math.round(position?.y ?? 0),
    width: Math.max(1, Math.round(position?.width ?? 1920)),
    height: Math.max(1, Math.round(position?.height ?? 1080)),
  }
}

export function withWindowPresetDefaults(windowPreset: WindowPreset): WindowPreset {
  const id = windowPreset.id.trim()
  const rendererType = windowPreset.rendererType.trim()
  return {
    id,
    label: windowPreset.label.trim() || id || 'Untitled Window Preset',
    rendererType,
    config: structuredClone(windowPreset.config ?? {}),
    defaultPosition: windowPreset.defaultPosition ? normalizeSourcePosition(windowPreset.defaultPosition) : undefined,
  }
}

export function withWindowPresetListDefaults(windowPresets?: WindowPreset[] | null): WindowPreset[] {
  return (windowPresets ?? [])
    .map((windowPreset) => withWindowPresetDefaults(windowPreset))
    .filter((windowPreset) => Boolean(windowPreset.id && windowPreset.rendererType))
}

export function withWindowInstanceDefaults(instance: WindowInstance): WindowInstance {
  return {
    ...instance,
    id: instance.id.trim(),
    windowPresetId: instance.windowPresetId?.trim() || undefined,
    rendererType: instance.rendererType?.trim() || undefined,
    config: instance.config ? structuredClone(instance.config) : undefined,
    position: normalizeSourcePosition(instance.position),
    zIndex: Math.round(instance.zIndex ?? 0),
    visible: instance.visible ?? true,
  }
}

export function resolveWindowInstance(instance: WindowInstance, windowPresets?: WindowPreset[] | null) {
  const normalized = withWindowInstanceDefaults(instance)
  const preset = normalized.windowPresetId
    ? withWindowPresetListDefaults(windowPresets).find((entry) => entry.id === normalized.windowPresetId)
    : undefined
  const rendererType = preset?.rendererType ?? normalized.rendererType
  if (!rendererType) return null

  return {
    ...normalized,
    rendererType,
    config: structuredClone(preset?.config ?? normalized.config ?? {}),
  }
}

export function withAutoTriggerDefaults(auto?: Partial<AutoTrigger> | null): AutoTrigger {
  return {
    enabled: auto?.enabled ?? false,
    mode: auto?.mode === 'idle' ? 'idle' : 'interval',
    intervalMin: Math.max(1, Math.round(auto?.intervalMin ?? 15)),
    idleMin: Math.max(1, Math.round(auto?.idleMin ?? 5)),
    chance: clampUnitInterval(auto?.chance, 1),
    cooldownMin: Math.max(0, Math.round(auto?.cooldownMin ?? 0)),
    allowedStates: normalizeAllowedStates(auto?.allowedStates),
  }
}

function normalizeEventAction(action: EventAction): EventAction | null {
  const normalizeRuntimeActionTimeoutSeconds = (value?: number) => Math.max(1, Math.min(3600, Math.round(value ?? 30)))

  if (action.kind === 'desktop-config') {
    const patch: NonNullable<Extract<EventAction, { kind: 'desktop-config' }>['patch']> = {}
    if (action.patch.theme !== undefined) patch.theme = normalizeEventDesktopTheme(action.patch.theme)
    if (action.patch.iconAnimation !== undefined) patch.iconAnimation = action.patch.iconAnimation
    if (action.patch.iconMotion !== undefined && Number.isFinite(action.patch.iconMotion)) {
      patch.iconMotion = Math.max(0, Math.min(3, action.patch.iconMotion))
    }
    if (action.patch.widgetTheme) {
      patch.widgetTheme = normalizeEventWidgetThemePatch(action.patch.widgetTheme)
    }
    if (action.patch.screenSaver) {
      patch.screenSaver = {
        enabled: action.patch.screenSaver.enabled ?? false,
        timeoutMinutes: Math.max(1, Math.round(action.patch.screenSaver.timeoutMinutes ?? 5)),
        preset: action.patch.screenSaver.preset ?? 'starfield',
      }
    }
    return { kind: 'desktop-config', patch, timeoutSeconds: normalizeRuntimeActionTimeoutSeconds(action.timeoutSeconds) }
  }

  if (action.kind === 'widget-themes') {
    const widgetIds = Array.from(new Set((action.widgetIds ?? []).map((widgetId) => widgetId.trim()).filter(Boolean)))
    return {
      kind: 'widget-themes',
      timeoutSeconds: normalizeRuntimeActionTimeoutSeconds(action.timeoutSeconds),
      widgetIds,
      clearExisting: action.clearExisting ?? false,
      theme: normalizeEventWidgetThemePatch(action.theme),
    }
  }

  if (action.kind === 'widget-layout') {
    const layoutId = action.layoutId.trim()
    return layoutId
      ? { kind: 'widget-layout', layoutId, timeoutSeconds: normalizeRuntimeActionTimeoutSeconds(action.timeoutSeconds) }
      : null
  }

  if (action.kind === 'widget-command') {
    const widgetId = action.widgetId.trim()
    if (!widgetId) return null
    return {
      kind: 'widget-command',
      widgetId,
      action: action.action === 'open' || action.action === 'close' ? action.action : 'toggle',
    }
  }

  if (action.kind === 'obs-stream') {
    return { kind: 'obs-stream', action: action.action, rtmpUrl: action.rtmpUrl, streamKey: action.streamKey }
  }

  if (action.kind === 'scene-change') {
    return { kind: 'scene-change', target: action.target }
  }

  if (action.kind === 'transition') {
    return { kind: 'transition', transitionId: action.transitionId }
  }

  return {
    kind: 'ambiance-patch',
    timeoutSeconds: normalizeRuntimeActionTimeoutSeconds(action.timeoutSeconds),
    patch: {
      enabled: action.patch.enabled,
      intervalSeconds: action.patch.intervalSeconds !== undefined
        ? Math.max(1, Math.round(action.patch.intervalSeconds))
        : undefined,
      maxOpenWidgets: action.patch.maxOpenWidgets !== undefined
        ? Math.max(1, Math.round(action.patch.maxOpenWidgets))
        : undefined,
      openWhileOneOpenChance: action.patch.openWhileOneOpenChance !== undefined
        ? clampUnitInterval(action.patch.openWhileOneOpenChance, 0.35)
        : undefined,
      behaviors: action.patch.behaviors,
    },
  }
}

export function withEventConfigDefaults(event: EventConfig): EventConfig {
  return {
    ...event,
    effects: Array.isArray(event.effects) ? event.effects.map((effect) => structuredClone(effect)) : [],
    actions: Array.isArray(event.actions)
      ? event.actions.map((action) => normalizeEventAction(action)).filter((action): action is EventAction => action !== null)
      : [],
    auto: withAutoTriggerDefaults(event.auto),
  }
}

export function withEventListDefaults(events?: EventConfig[] | null): EventConfig[] {
  return (events ?? []).map((event) => withEventConfigDefaults(event))
}

const WIDGET_SHAPES: readonly WidgetShape[] = [
  'rect', 'bevel', 'notch-hud', 'blob', 'tv', 'sticker',
  'metalheart', 'wing', 'wave', 'shard', 'pod',
]

function normalizeWidgetShape(value: unknown, fallback: WidgetShape = 'rect'): WidgetShape {
  return WIDGET_SHAPES.includes(value as WidgetShape) ? (value as WidgetShape) : fallback
}

function normalizeWidgetThemeAnimation(value?: WidgetThemeAnimation): WidgetThemeAnimation {
  if (value === 'steady' || value === 'pulse' || value === 'shimmer' || value === 'aurora' || value === 'broadcast') {
    return value
  }
  return 'shimmer'
}

function normalizeWidgetThemeAtmosphere(value?: WidgetThemeAtmosphere): WidgetThemeAtmosphere {
  if (value === 'clean' || value === 'sparkle' || value === 'scanlines' || value === 'grid' || value === 'nebula') {
    return value
  }
  return 'sparkle'
}

function normalizeEventDesktopTheme(theme?: EventDesktopTheme | 'win vista'): EventDesktopTheme {
  if (theme === 'random') return 'random'
  return normalizeDesktopTheme(theme)
}

function normalizeWidgetThemeIntensity(value: number | undefined, fallback: number) {
  if (!Number.isFinite(value)) return fallback
  return Math.min(3, Math.max(0, Math.round((value as number) * 100) / 100))
}

function normalizeEventWidgetThemePatch(config?: EventWidgetThemePatch | null): EventWidgetThemePatch {
  if (!config) return {}

  const next: EventWidgetThemePatch = {}

  if (config.skin !== undefined) {
    next.skin = config.skin === 'random' ? 'random' : normalizeWidgetSkinTheme(config.skin)
  }
  if (typeof config.fontFamily === 'string' && config.fontFamily.trim()) {
    next.fontFamily = config.fontFamily
  }
  if (typeof config.accentColor === 'string' && config.accentColor.trim()) {
    next.accentColor = config.accentColor
  }
  if (typeof config.textColor === 'string' && config.textColor.trim()) {
    next.textColor = config.textColor
  }
  if (config.animation !== undefined) {
    next.animation = normalizeWidgetThemeAnimation(config.animation)
  }
  if (config.atmosphere !== undefined) {
    next.atmosphere = normalizeWidgetThemeAtmosphere(config.atmosphere)
  }
  if (config.shape !== undefined) {
    next.shape = normalizeWidgetShape(config.shape)
  }
  if (config.motionIntensity !== undefined && Number.isFinite(config.motionIntensity)) {
    next.motionIntensity = normalizeWidgetThemeIntensity(config.motionIntensity, 1)
  }
  if (config.glowIntensity !== undefined && Number.isFinite(config.glowIntensity)) {
    next.glowIntensity = normalizeWidgetThemeIntensity(config.glowIntensity, 1)
  }

  return next
}

function normalizeWidgetThemeIntensityField(value: unknown, fallback: number, min = 0, max = 3): number {
  const n = Number(value)
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback
}

function normalizeWidgetThemeConfig(config?: Partial<WidgetThemeConfig> | null): WidgetThemeConfig {
  const widgetSkin = normalizeWidgetSkinTheme(config?.skin)
  const widgetPreset = DEFAULT_WIDGET_THEME_PRESETS[widgetSkin]

  return {
    ...widgetPreset,
    ...config,
    skin: widgetSkin,
    shape: normalizeWidgetShape(config?.shape, widgetPreset.shape),
    animation: normalizeWidgetThemeAnimation(config?.animation ?? widgetPreset.animation),
    atmosphere: normalizeWidgetThemeAtmosphere(config?.atmosphere ?? widgetPreset.atmosphere),
    motionIntensity: normalizeWidgetThemeIntensity(config?.motionIntensity, widgetPreset.motionIntensity),
    glowIntensity: normalizeWidgetThemeIntensity(config?.glowIntensity, widgetPreset.glowIntensity),
    shellOpacity: normalizeWidgetThemeIntensityField(config?.shellOpacity, widgetPreset.shellOpacity, 0, 1),
    shadowIntensity: normalizeWidgetThemeIntensityField(config?.shadowIntensity, widgetPreset.shadowIntensity, 0, 3),
    borderRadius: normalizeWidgetThemeIntensityField(config?.borderRadius, widgetPreset.borderRadius, 0, 32),
    titleColor: typeof config?.titleColor === 'string' ? config.titleColor : (widgetPreset.titleColor ?? ''),
  }
}

function normalizeWidgetThemes(value?: DesktopConfig['widgetThemes']) {
  if (!value) return undefined

  const entries = Object.entries(value).reduce<Record<string, WidgetThemeConfig>>((acc, [widgetId, theme]) => {
    const normalizedId = typeof widgetId === 'string' ? widgetId.trim() : ''
    if (!normalizedId) return acc
    acc[normalizedId] = normalizeWidgetThemeConfig(theme)
    return acc
  }, {})

  return Object.keys(entries).length ? entries : undefined
}

function buildSolidGradient(color: string) {
  return `linear-gradient(180deg, ${color} 0%, ${color} 100%)`
}

export const DEFAULT_STICKY_NOTES_SETTINGS: StickyNotesSettings = {
  text: 'Reminder:\n- queue scenes\n- test alerts\n- hydrate',
  color: '#fff2a8',
}

export const DEFAULT_WIDGET_THEME_PRESETS: Record<WidgetSkinTheme, WidgetThemeConfig> = {
  metalheart:         { skin: 'metalheart',       shape: 'metalheart', fontFamily: 'Audiowide',       accentColor: '#ff5c8a', textColor: '#f8fbff', titleColor: '',        animation: 'shimmer',   atmosphere: 'sparkle',   motionIntensity: 0.95, glowIntensity: 1.2,  shellOpacity: 1,    shadowIntensity: 1.2, borderRadius: 0  },
  'genx soft club':   { skin: 'genx soft club',   shape: 'pod',       fontFamily: 'Electrolize',     accentColor: '#ff94d6', textColor: '#2c1430', titleColor: '',        animation: 'pulse',     atmosphere: 'sparkle',   motionIntensity: 1.15, glowIntensity: 0.85, shellOpacity: 1,    shadowIntensity: 0.8, borderRadius: 8  },
  chromecore:         { skin: 'chromecore',        shape: 'rect',      fontFamily: 'Rajdhani',        accentColor: '#7fe0ff', textColor: '#152433', titleColor: '',        animation: 'shimmer',   atmosphere: 'grid',      motionIntensity: 0.8,  glowIntensity: 0.95, shellOpacity: 1,    shadowIntensity: 1.0, borderRadius: 2  },
  'y2k futurism':     { skin: 'y2k futurism',      shape: 'notch-hud', fontFamily: 'Orbitron',        accentColor: '#2cf7ff', textColor: '#ebfbff', titleColor: '',        animation: 'aurora',    atmosphere: 'nebula',    motionIntensity: 1.35, glowIntensity: 1.6,  shellOpacity: 1,    shadowIntensity: 1.6, borderRadius: 4  },
  transparent:        { skin: 'transparent',       shape: 'rect',      fontFamily: 'Share Tech Mono', accentColor: '#b8f4ff', textColor: '#effcff', titleColor: '',        animation: 'broadcast', atmosphere: 'scanlines', motionIntensity: 1,    glowIntensity: 1.05, shellOpacity: 0.55, shadowIntensity: 0.4, borderRadius: 6  },
  'aqua pop':         { skin: 'aqua pop',          shape: 'blob',      fontFamily: 'Rajdhani',        accentColor: '#4ddcff', textColor: '#08374c', titleColor: '',        animation: 'shimmer',   atmosphere: 'sparkle',   motionIntensity: 1.05, glowIntensity: 1.25, shellOpacity: 0.92, shadowIntensity: 1.1, borderRadius: 10 },
  'mallsoft pearl':   { skin: 'mallsoft pearl',    shape: 'blob',      fontFamily: 'Electrolize',     accentColor: '#ffb8e8', textColor: '#5a2b58', titleColor: '',        animation: 'aurora',    atmosphere: 'nebula',    motionIntensity: 0.9,  glowIntensity: 1.15, shellOpacity: 0.9,  shadowIntensity: 0.7, borderRadius: 12 },
  'messenger glow':   { skin: 'messenger glow',   shape: 'rect',      fontFamily: 'Audiowide',       accentColor: '#75ffb2', textColor: '#16352a', titleColor: '',        animation: 'pulse',     atmosphere: 'grid',      motionIntensity: 1.15, glowIntensity: 1,    shellOpacity: 1,    shadowIntensity: 1.0, borderRadius: 4  },
  'limewire plasma':  { skin: 'limewire plasma',  shape: 'shard',     fontFamily: 'Share Tech Mono', accentColor: '#7aff54', textColor: '#e8ffe1', titleColor: '',        animation: 'broadcast', atmosphere: 'scanlines', motionIntensity: 1.35, glowIntensity: 1.45, shellOpacity: 1,    shadowIntensity: 1.4, borderRadius: 0  },
  'cyber y2k':        { skin: 'cyber y2k',         shape: 'notch-hud', fontFamily: 'Orbitron',        accentColor: '#ff6dff', textColor: '#f4fbff', titleColor: '',        animation: 'aurora',    atmosphere: 'grid',      motionIntensity: 1.45, glowIntensity: 1.7,  shellOpacity: 1,    shadowIntensity: 1.7, borderRadius: 2  },
  'digital futurism': { skin: 'digital futurism',  shape: 'rect',      fontFamily: 'Audiowide',       accentColor: '#56f0ff', textColor: '#eafcff', titleColor: '',        animation: 'shimmer',   atmosphere: 'nebula',    motionIntensity: 1.1,  glowIntensity: 1.35, shellOpacity: 0.95, shadowIntensity: 1.3, borderRadius: 4  },
  'ssx rush':         { skin: 'ssx rush',          shape: 'wing',      fontFamily: 'Rajdhani',        accentColor: '#ff8e2b', textColor: '#4b1322', titleColor: '',        animation: 'pulse',     atmosphere: 'sparkle',   motionIntensity: 1.55, glowIntensity: 1.2,  shellOpacity: 1,    shadowIntensity: 1.2, borderRadius: 6  },
  'ps2 drift':        { skin: 'ps2 drift',         shape: 'rect',      fontFamily: 'Electrolize',     accentColor: '#6ba4ff', textColor: '#edf3ff', titleColor: '',        animation: 'broadcast', atmosphere: 'grid',      motionIntensity: 1.1,  glowIntensity: 1.1,  shellOpacity: 1,    shadowIntensity: 1.0, borderRadius: 0  },
  'xbox blade':       { skin: 'xbox blade',        shape: 'bevel',     fontFamily: 'Share Tech Mono', accentColor: '#79ff5a', textColor: '#efffe7', titleColor: '',        animation: 'broadcast', atmosphere: 'scanlines', motionIntensity: 1.25, glowIntensity: 1.3,  shellOpacity: 1,    shadowIntensity: 1.3, borderRadius: 2  },
  'cel street':       { skin: 'cel street',        shape: 'sticker',   fontFamily: 'Audiowide',       accentColor: '#ffd447', textColor: '#1a1f2f', titleColor: '',        animation: 'pulse',     atmosphere: 'clean',     motionIntensity: 1.2,  glowIntensity: 0.9,  shellOpacity: 1,    shadowIntensity: 0.9, borderRadius: 4  },
  'aero nova':        { skin: 'aero nova',         shape: 'tv',        fontFamily: 'Rajdhani',        accentColor: '#59d7ff', textColor: '#103b58', titleColor: '',        animation: 'aurora',    atmosphere: 'sparkle',   motionIntensity: 1.05, glowIntensity: 1.45, shellOpacity: 0.88, shadowIntensity: 0.6, borderRadius: 14 },
  'aero opaline':     { skin: 'aero opaline',      shape: 'tv',        fontFamily: 'Electrolize',     accentColor: '#7ceee7', textColor: '#1a4960', titleColor: '',        animation: 'shimmer',   atmosphere: 'nebula',    motionIntensity: 0.95, glowIntensity: 1.25, shellOpacity: 0.82, shadowIntensity: 0.5, borderRadius: 16 },
  'dial-up candy':    { skin: 'dial-up candy',     shape: 'rect',      fontFamily: 'Trebuchet MS',    accentColor: '#58c8ff', textColor: '#20344d', titleColor: '',        animation: 'broadcast', atmosphere: 'sparkle',   motionIntensity: 1.25, glowIntensity: 1.05, shellOpacity: 1,    shadowIntensity: 0.9, borderRadius: 8  },
  'webcore flash':    { skin: 'webcore flash',     shape: 'wave',      fontFamily: 'Audiowide',       accentColor: '#ffdf3c', textColor: '#201834', titleColor: '',        animation: 'pulse',     atmosphere: 'grid',      motionIntensity: 1.4,  glowIntensity: 1.2,  shellOpacity: 1,    shadowIntensity: 1.1, borderRadius: 6  },
  'lan party':        { skin: 'lan party',         shape: 'notch-hud', fontFamily: 'Share Tech Mono', accentColor: '#67ffcc', textColor: '#e7fff7', titleColor: '',        animation: 'broadcast', atmosphere: 'scanlines', motionIntensity: 1.35, glowIntensity: 1.45, shellOpacity: 1,    shadowIntensity: 1.4, borderRadius: 0  },
  // ── Aesthetic Cartridges ──────────────────────────────────────
  'aero saint':       { skin: 'aero saint',         shape: 'tv',        fontFamily: 'Rajdhani',        accentColor: '#6fd1ff', textColor: '#083048', titleColor: '',        animation: 'aurora',    atmosphere: 'sparkle',   motionIntensity: 0.9,  glowIntensity: 1.4,  shellOpacity: 0.9,  shadowIntensity: 0.6, borderRadius: 16 },
  'chrome requiem':   { skin: 'chrome requiem',     shape: 'bevel',     fontFamily: 'Audiowide',       accentColor: '#c9313a', textColor: '#f2f0ea', titleColor: '',        animation: 'broadcast', atmosphere: 'scanlines', motionIntensity: 0.9,  glowIntensity: 1.1,  shellOpacity: 1,    shadowIntensity: 1.4, borderRadius: 0  },
  'trick city':       { skin: 'trick city',         shape: 'wing',      fontFamily: 'Rajdhani',        accentColor: '#ff6b35', textColor: '#1c1c22', titleColor: '',        animation: 'pulse',     atmosphere: 'sparkle',   motionIntensity: 1.5,  glowIntensity: 1.25, shellOpacity: 1,    shadowIntensity: 1.1, borderRadius: 4  },
  'save point':       { skin: 'save point',         shape: 'codex',     fontFamily: 'Orbitron',        accentColor: '#5b7cff', textColor: '#eaf0ff', titleColor: '',        animation: 'steady',    atmosphere: 'nebula',    motionIntensity: 0.7,  glowIntensity: 1.15, shellOpacity: 1,    shadowIntensity: 1.0, borderRadius: 2  },
  'dial tone dream':  { skin: 'dial tone dream',    shape: 'blob',      fontFamily: 'Trebuchet MS',    accentColor: '#ff9ecb', textColor: '#5a2b58', titleColor: '',        animation: 'pulse',     atmosphere: 'sparkle',   motionIntensity: 1,    glowIntensity: 1,    shellOpacity: 0.92, shadowIntensity: 0.6, borderRadius: 14 },
  'signal ghost':     { skin: 'signal ghost',       shape: 'rect',      fontFamily: 'Share Tech Mono', accentColor: '#ff2e88', textColor: '#e7e7ef', titleColor: '',        animation: 'broadcast', atmosphere: 'scanlines', motionIntensity: 1.2,  glowIntensity: 1.3,  shellOpacity: 1,    shadowIntensity: 1.3, borderRadius: 2  },
  'podium chrome':    { skin: 'podium chrome',      shape: 'tv',        fontFamily: 'Electrolize',     accentColor: '#f5d67a', textColor: '#2c2408', titleColor: '',        animation: 'aurora',    atmosphere: 'sparkle',   motionIntensity: 0.85, glowIntensity: 1.3,  shellOpacity: 0.94, shadowIntensity: 0.7, borderRadius: 16 },
}

const DEFAULT_OVERLAY_STYLE: OverlayStyle = {
  background: {
    type: 'none',
    color: '#000000',
    gradient: 'linear-gradient(135deg, #0c0c1e 0%, #1a0533 50%, #0c0c1e 100%)',
    imageUrl: '',
    videoUrl: '',
    pattern: 'none',
    opacity: 0,
    blur: 0,
  },
  effects: {
    crt: true,
    noise: false,
    vignette: true,
    flicker: false,
    chromatic: false,
    scanlineOpacity: 0.18,
    noiseOpacity: 0.06,
    vignetteStrength: 0.65,
  },
  particles: {
    enabled: false,
    preset: 'none',
    density: 0.5,
    speed: 0.4,
  },
  fontFamily: 'default',
  accentColor: '#00ff41',
  textColor: '#ffffff',
}

export function withOverlayStyleDefaults(style: OverlayStyle | null | undefined, fallback: OverlayStyle = DEFAULT_OVERLAY_STYLE): OverlayStyle {
  const nextStyle: OverlayStyle = {
    ...fallback,
    ...style,
    background: {
      ...fallback.background,
      ...style?.background,
    },
    effects: {
      ...fallback.effects,
      ...style?.effects,
    },
    particles: {
      ...fallback.particles,
      ...style?.particles,
    },
  }

  if (!nextStyle.background.gradient) {
    nextStyle.background.gradient = buildSolidGradient(nextStyle.background.color)
  }

  if (nextStyle.background.type === 'color') {
    nextStyle.background.type = 'gradient'
    nextStyle.background.gradient = buildSolidGradient(nextStyle.background.color)
  }

  return nextStyle
}

export function withLobbyConfigDefaults(config?: Partial<LobbyConfig> | null): LobbyConfig {
  const legacySkyColor = config?.skyColor
  return {
    ...DEFAULT_LOBBY_CONFIG,
    ...config,
    skyTopColor: config?.skyTopColor ?? legacySkyColor ?? DEFAULT_LOBBY_CONFIG.skyTopColor,
    skyHorizonColor: config?.skyHorizonColor ?? legacySkyColor ?? DEFAULT_LOBBY_CONFIG.skyHorizonColor,
    virtualPet: {
      ...DEFAULT_LOBBY_CONFIG.virtualPet,
      ...config?.virtualPet,
    },
    lavaLamp: {
      ...DEFAULT_LOBBY_CONFIG.lavaLamp,
      ...config?.lavaLamp,
    },
    fishTank: {
      ...DEFAULT_LOBBY_CONFIG.fishTank,
      ...config?.fishTank,
    },
  }
}

function buildDefaultGlobalThemeDefaultConfig(): DesktopConfig['globalThemeDefault'] {
  return {
    theme: 'win98',
    widgetTheme: normalizeWidgetThemeConfig(DEFAULT_WIDGET_THEME_PRESETS.metalheart),
    appearance: {
      fontFamily: 'default',
      accentColor: '#00ff41',
      textColor: '#ffffff',
    },
  }
}

function normalizeGlobalThemeDefaultConfig(value?: Partial<DesktopConfig['globalThemeDefault']> | null): DesktopConfig['globalThemeDefault'] {
  const defaults = buildDefaultGlobalThemeDefaultConfig()
  return {
    theme: normalizeDesktopTheme(value?.theme as DesktopTheme | 'win vista' | undefined),
    widgetTheme: normalizeWidgetThemeConfig(value?.widgetTheme ?? defaults.widgetTheme),
    appearance: {
      ...defaults.appearance,
      ...value?.appearance,
    },
  }
}

export const DEFAULT_DESKTOP_CONFIG: DesktopConfig = {
  globalThemeDefault: buildDefaultGlobalThemeDefaultConfig(),
  defaultIconSize: 'normal',
  autoArrangeIcons: false,
  iconAnimation: 'none',
  iconArrangement: 'grid',
  iconMotion: 0.45,
  iconArrangementMotion: 1,
  recycleBin: {
    fullOnStart: false,
  },
  screenSaver: {
    enabled: false,
    timeoutMinutes: 5,
    preset: 'starfield',
  },
  systemSounds: {
    startup: '',
    error: '',
    notify: '',
    click: '',
    close: '',
  },
}

// ── Widget lookup tables — derived from WIDGET_DEFINITIONS ────────
// To add a widget: create packages/shared/src/widgets/{id}/definition.ts
// and add one line to packages/overlay/src/desktop/widgetRegistry.ts.

export const DEFAULT_SYSTEM_WIDGET_IDS: readonly string[] = WIDGET_DEFINITIONS
  .filter((d) => d.system)
  .map((d) => d.id)

export const DEFAULT_WIDGET_WINDOW_SIZES: Record<string, { width: number; height: number }> = {
  // Derived from WIDGET_DEFINITIONS
  ...Object.fromEntries(WIDGET_DEFINITIONS.map((d) => [d.id, d.defaultSize])),
  // Legacy aliases kept for backward compat
  spotify: { width: 280, height: 250 },
  browser: { width: 430, height: 320 },
}

// Legacy aliases: ID strings that map to a component type but have no WidgetDefinition entry
const WIDGET_COMPONENT_ALIASES: Record<string, Exclude<WidgetComponentType, 'generic'>> = {
  browser: 'gallery',
  spotify: 'music',
}

const KNOWN_WIDGET_COMPONENTS_BY_ID: Record<string, Exclude<WidgetComponentType, 'generic'>> = {
  ...Object.fromEntries(WIDGET_DEFINITIONS.map((d) => [d.id, d.componentType])),
  ...WIDGET_COMPONENT_ALIASES,
}

const ALL_WIDGET_COMPONENT_TYPES = new Set<WidgetComponentType>([
  ...WIDGET_DEFINITIONS.map((d) => d.componentType),
  'window',
  'generic',
])

const _componentSizeMap = new Map<WidgetComponentType, { width: number; height: number }>(
  WIDGET_DEFINITIONS.map((d) => [d.componentType, d.defaultSize])
)
_componentSizeMap.set('window',  { width: 420, height: 320 })
_componentSizeMap.set('camera',  { width: 400, height: 300 })
_componentSizeMap.set('generic', { width: 260, height: 240 })

const DEFAULT_WIDGET_COMPONENT_WINDOW_SIZES: Record<WidgetComponentType, { width: number; height: number }> =
  Object.fromEntries(_componentSizeMap) as Record<WidgetComponentType, { width: number; height: number }>

const _componentZIndexMap = new Map<WidgetComponentType, number>(
  WIDGET_DEFINITIONS.map((d) => [d.componentType, d.zIndex])
)
_componentZIndexMap.set('window',  25)
_componentZIndexMap.set('generic', 0)

const DEFAULT_WIDGET_COMPONENT_Z_INDICES: Record<WidgetComponentType, number> =
  Object.fromEntries(_componentZIndexMap) as Record<WidgetComponentType, number>

function isWidgetComponentType(value: unknown): value is WidgetComponentType {
  return typeof value === 'string' && ALL_WIDGET_COMPONENT_TYPES.has(value as WidgetComponentType)
}

function normalizeWindowWidgetSettings(settings?: WindowWidgetSettings | null): WindowWidgetSettings | undefined {
  if (!settings) return undefined

  const trimmed = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined)
  const rendererType = trimmed(settings.rendererType)
  const sceneId = trimmed(settings.sceneId)

  // Legacy scene-window bindings ({ sceneId, windowId }) collapse to scene mode.
  const mode: WindowWidgetSettings['mode'] = settings.mode === 'renderer' || settings.mode === 'scene'
    ? settings.mode
    : rendererType
      ? 'renderer'
      : sceneId
        ? 'scene'
        : undefined

  if (!mode) return undefined
  if (mode === 'renderer' && !rendererType) return sceneId ? { mode: 'scene', sceneId } : undefined
  if (mode === 'scene' && !sceneId) return rendererType ? { mode: 'renderer', rendererType } : undefined

  return {
    mode,
    ...(rendererType ? { rendererType } : {}),
    ...(sceneId ? { sceneId } : {}),
  }
}

function normalizeStickyNotesSettings(settings?: Partial<StickyNotesSettings> | null): StickyNotesSettings {
  return {
    ...DEFAULT_STICKY_NOTES_SETTINGS,
    ...settings,
  }
}

export function isSystemWidgetId(widgetId: string) {
  return (DEFAULT_SYSTEM_WIDGET_IDS as readonly string[]).includes(widgetId)
}

export function getWidgetSource(app: Pick<Application, 'id' | 'widgetSource'>): WidgetLayoutSource {
  return isSystemWidgetId(app.id) ? 'system' : 'user'
}

export function getWidgetComponent(app: Pick<Application, 'id' | 'widgetComponent'>): WidgetComponentType {
  if (KNOWN_WIDGET_COMPONENTS_BY_ID[app.id]) return KNOWN_WIDGET_COMPONENTS_BY_ID[app.id]
  if (isWidgetComponentType(app.widgetComponent) && app.widgetComponent !== 'generic') return app.widgetComponent
  if (/^camera(?:[-:_].+)?$/i.test(app.id)) return 'camera'
  if (/^window(?:[-:_].+)?$/i.test(app.id)) return 'window'
  if (isWidgetComponentType(app.widgetComponent)) return app.widgetComponent
  return 'generic'
}

export function isSystemWidget(app: Pick<Application, 'id' | 'widgetSource'>) {
  return getWidgetSource(app) === 'system'
}

export function getDefaultWidgetWindowSize(widgetId: string, widgetComponent?: WidgetComponentType) {
  return DEFAULT_WIDGET_WINDOW_SIZES[widgetId]
    ?? (widgetComponent ? DEFAULT_WIDGET_COMPONENT_WINDOW_SIZES[widgetComponent] : undefined)
    ?? DEFAULT_WIDGET_COMPONENT_WINDOW_SIZES.generic
}

export function getDefaultWidgetZIndex(widgetId: string, widgetComponent?: WidgetComponentType) {
  return (widgetComponent ? DEFAULT_WIDGET_COMPONENT_Z_INDICES[widgetComponent] : undefined)
    ?? DEFAULT_WIDGET_COMPONENT_Z_INDICES.generic
}

export function withApplicationDefaults(app: Application): Application {
  const next: Application = {
    ...app,
    widgetSource: getWidgetSource(app),
    widgetComponent: getWidgetComponent(app),
    windowWidgetSettings: normalizeWindowWidgetSettings(app.windowWidgetSettings),
  }

  if (next.id === 'sticky-notes') {
    next.stickyNotesSettings = normalizeStickyNotesSettings(next.stickyNotesSettings)
  }

  return next
}

export function withApplicationListDefaults(applications?: Application[] | null): Application[] {
  return (applications ?? []).map((app) => withApplicationDefaults(app))
}


export const DEFAULT_DESKTOP_NOTIFICATION_DURATION_MS = 6500
export const DEFAULT_DESKTOP_NOTIFICATION_MAX_VISIBLE = 3

function normalizeWidgetDimension(value: number | undefined, min: number, max: number) {
  if (!Number.isFinite(value)) return undefined
  const rounded = Math.round(value as number)
  return Math.min(max, Math.max(min, rounded))
}

function normalizeWidgetLayoutCoordinate(value: number | undefined, fallback: number) {
  if (!Number.isFinite(value)) return fallback
  return Math.max(0, Math.round(value as number))
}

function normalizeWidgetFocusPriority(value: number | undefined, fallback: number) {
  if (!Number.isFinite(value)) return fallback
  return Math.max(-999, Math.min(999, Math.round(value as number)))
}

function normalizeWidgetLayoutItems(items?: WidgetLayoutItem[]) {
  if (!items) return []
  const entries = items.reduce<WidgetLayoutItem[]>((acc, item) => {
    const widgetId = typeof item.widgetId === 'string' ? item.widgetId.trim() : ''
    if (!widgetId) return acc

    acc.push({
      widgetId,
      enabled: !!item.enabled,
      x: normalizeWidgetLayoutCoordinate(item.x, 80),
      y: normalizeWidgetLayoutCoordinate(item.y, 80),
      width: normalizeWidgetDimension(item.width, 180, 1400) ?? 260,
      height: normalizeWidgetDimension(item.height, 140, 1000) ?? 240,
      focusPriority: normalizeWidgetFocusPriority(item.focusPriority, 0),
    })
    return acc
  }, [])

  return entries
}

function normalizeWidgetLayoutSnapshot(snapshot?: WidgetLayoutSnapshot) {
  if (!snapshot) return undefined

  const label = typeof snapshot.label === 'string' ? snapshot.label.trim() : ''
  if (!label) return undefined

  const items = normalizeWidgetLayoutItems(snapshot.items)
  if (items.length === 0) return undefined

  return {
    label,
    icon: typeof snapshot.icon === 'string' && snapshot.icon.trim() ? snapshot.icon.trim() : '📐',
    description: typeof snapshot.description === 'string' && snapshot.description.trim() ? snapshot.description.trim() : undefined,
    items,
  } satisfies WidgetLayoutSnapshot
}

function normalizeWidgetLayouts(value?: WidgetLayoutDefinition[]) {
  return (value ?? []).reduce<WidgetLayoutDefinition[]>((acc, layout) => {
    const id = typeof layout.id === 'string' ? layout.id.trim() : ''
    const label = typeof layout.label === 'string' ? layout.label.trim() : ''
    if (!id || !label || layout.source === 'system') return acc

    const items = normalizeWidgetLayoutItems(layout.items)
    const icon = typeof layout.icon === 'string' && layout.icon.trim() ? layout.icon.trim() : '📐'
    const description = typeof layout.description === 'string' && layout.description.trim() ? layout.description.trim() : undefined
    const currentSnapshot: WidgetLayoutSnapshot = { label, icon, description, items: items.map((i) => ({ ...i })) }

    acc.push({
      id,
      label,
      icon,
      source: 'user',
      description,
      items,
      defaultConfig: normalizeWidgetLayoutSnapshot(layout.defaultConfig) ?? currentSnapshot,
    } satisfies WidgetLayoutDefinition)
    return acc
  }, [])
}

export function withDesktopConfigDefaults(config?: Partial<DesktopConfig> | null): DesktopConfig {
  const source = (config ?? {}) as Partial<DesktopConfig> & {
    theme?: DesktopTheme | 'win vista'
    widgetTheme?: Partial<WidgetThemeConfig>
    notifications?: unknown
    stickyNotes?: Partial<StickyNotesSettings> | null
    recycleBin?: Partial<DesktopConfig['recycleBin']>
  }
  const { notifications: _legacyNotifications, stickyNotes: _legacyStickyNotes, theme: _legacyTheme, widgetTheme: _legacyWidgetTheme, ...rest } = source
  const legacyRecycleBin: Partial<DesktopConfig['recycleBin']> = source.recycleBin ?? {}
  const { ...recycleBin } = legacyRecycleBin

  // Migrate legacy top-level theme/widgetTheme into globalThemeDefault when upgrading old DB data
  const globalThemeDefault = normalizeGlobalThemeDefaultConfig({
    theme: source.globalThemeDefault?.theme ?? normalizeDesktopTheme(_legacyTheme),
    widgetTheme: source.globalThemeDefault?.widgetTheme ?? (_legacyWidgetTheme as WidgetThemeConfig | undefined),
    appearance: source.globalThemeDefault?.appearance,
  })

  return {
    ...DEFAULT_DESKTOP_CONFIG,
    ...rest,
    globalThemeDefault,
    widgetThemes: normalizeWidgetThemes(source.widgetThemes),
    recycleBin: {
      ...DEFAULT_DESKTOP_CONFIG.recycleBin,
      ...recycleBin,
    },
    screenSaver: {
      ...DEFAULT_DESKTOP_CONFIG.screenSaver,
      ...source.screenSaver,
    },
    systemSounds: {
      ...DEFAULT_DESKTOP_CONFIG.systemSounds,
      ...source.systemSounds,
    },
  }
}

export const DEFAULT_DESKTOP_AMBIANCE_CONFIG: DesktopAmbianceConfig = {
  widgetSimulation: {
    enabled: false,
    intervalSeconds: 30,
    maxOpenWidgets: 2,
    openWhileOneOpenChance: 0.35,
    cursorSpeedMultiplier: 1.0,
    tickJitterFactor: 0.2,
    moveJitter: 0.3,
    pauseAfterActionMs: 0,
    behaviors: {},
  },
}

export function withDesktopAmbianceDefaults(config?: Partial<DesktopAmbianceConfig> | null): DesktopAmbianceConfig {
  return {
    ...DEFAULT_DESKTOP_AMBIANCE_CONFIG,
    ...config,
    widgetSimulation: {
      ...DEFAULT_DESKTOP_AMBIANCE_CONFIG.widgetSimulation,
      ...config?.widgetSimulation,
    },
  }
}

export const DEFAULT_DESKTOP_THEME_DRIFT: DesktopThemeDriftConfig = {
  enabled: false,
  intervalSeconds: 45,
  tickJitterFactor: 0.2,
  groups: {
    theme:      { enabled: true, chance: 0.15 },
    colors:     { enabled: true, chance: 0.2 },
    motion:     { enabled: true, chance: 0.2 },
    atmosphere: { enabled: true, chance: 0.2 },
  },
}

export function withDesktopThemeDriftDefaults(config?: Partial<DesktopThemeDriftConfig> | null): DesktopThemeDriftConfig {
  return {
    ...DEFAULT_DESKTOP_THEME_DRIFT,
    ...config,
    groups: {
      ...DEFAULT_DESKTOP_THEME_DRIFT.groups,
      ...config?.groups,
    },
  }
}

export function mergeAppConfig(base: AppConfig, updates: Partial<AppConfig>): AppConfig {
  const currentDesktopConfig = withDesktopConfigDefaults(base.desktopConfig)
  const currentDesktopAmbiance = withDesktopAmbianceDefaults(base.desktopAmbiance)
  const nextDesktopConfig = updates.desktopConfig
    ? {
        ...currentDesktopConfig,
        ...updates.desktopConfig,
        globalThemeDefault: updates.desktopConfig.globalThemeDefault
          ? {
              ...currentDesktopConfig.globalThemeDefault,
              ...updates.desktopConfig.globalThemeDefault,
              widgetTheme: updates.desktopConfig.globalThemeDefault.widgetTheme
                ? {
                    ...currentDesktopConfig.globalThemeDefault.widgetTheme,
                    ...updates.desktopConfig.globalThemeDefault.widgetTheme,
                  }
                : currentDesktopConfig.globalThemeDefault.widgetTheme,
              appearance: updates.desktopConfig.globalThemeDefault.appearance
                ? {
                    ...currentDesktopConfig.globalThemeDefault.appearance,
                    ...updates.desktopConfig.globalThemeDefault.appearance,
                  }
                : currentDesktopConfig.globalThemeDefault.appearance,
            }
          : currentDesktopConfig.globalThemeDefault,
        widgetThemes: 'widgetThemes' in updates.desktopConfig
          ? (Object.keys(updates.desktopConfig.widgetThemes ?? {}).length
              ? updates.desktopConfig.widgetThemes
              : undefined)
          : currentDesktopConfig.widgetThemes,
        recycleBin: updates.desktopConfig.recycleBin
          ? { ...currentDesktopConfig.recycleBin, ...updates.desktopConfig.recycleBin }
          : currentDesktopConfig.recycleBin,
        screenSaver: updates.desktopConfig.screenSaver
          ? { ...currentDesktopConfig.screenSaver, ...updates.desktopConfig.screenSaver }
          : currentDesktopConfig.screenSaver,
        systemSounds: updates.desktopConfig.systemSounds
          ? { ...currentDesktopConfig.systemSounds, ...updates.desktopConfig.systemSounds }
          : currentDesktopConfig.systemSounds,
      }
    : currentDesktopConfig

  return {
    ...base,
    ...updates,
    scenes: updates.scenes ?? base.scenes,
    applications: updates.applications ?? base.applications,
    keybinds: updates.keybinds
      ? {
          ...base.keybinds,
          ...updates.keybinds,
          obs: updates.keybinds.obs ? { ...base.keybinds.obs, ...updates.keybinds.obs } : base.keybinds.obs,
          admin: updates.keybinds.admin ? { ...base.keybinds.admin, ...updates.keybinds.admin } : base.keybinds.admin,
        }
      : base.keybinds,
    obs: updates.obs ? { ...base.obs, ...updates.obs } : base.obs,
    audio: updates.audio ? { ...base.audio, ...updates.audio } : base.audio,
    desktopConfig: nextDesktopConfig,
    desktopAmbiance: updates.desktopAmbiance
      ? {
          ...currentDesktopAmbiance,
          ...updates.desktopAmbiance,
          widgetSimulation: updates.desktopAmbiance.widgetSimulation
            ? {
                ...currentDesktopAmbiance.widgetSimulation,
                ...updates.desktopAmbiance.widgetSimulation,
                behaviors: updates.desktopAmbiance.widgetSimulation.behaviors
                  ? {
                      ...currentDesktopAmbiance.widgetSimulation.behaviors,
                      ...updates.desktopAmbiance.widgetSimulation.behaviors,
                    }
                  : currentDesktopAmbiance.widgetSimulation.behaviors,
              }
            : currentDesktopAmbiance.widgetSimulation,
        }
      : currentDesktopAmbiance,
    widgetLayouts: updates.widgetLayouts ?? base.widgetLayouts,
    sourceEvents: updates.sourceEvents ? withEventListDefaults(updates.sourceEvents) : withEventListDefaults(base.sourceEvents),
    sourceMedia: updates.sourceMedia ?? base.sourceMedia,
    windowPresets: updates.windowPresets ? withWindowPresetListDefaults(updates.windowPresets) : withWindowPresetListDefaults(base.windowPresets),
    sourceTransitions: updates.sourceTransitions ?? base.sourceTransitions,
  }
}

export function applyRuntimeConfig(base: AppConfig, runtimeConfig: RuntimeConfig): AppConfig {
  if (!runtimeConfig || Object.keys(runtimeConfig).length === 0) return base

  let applications = base.applications
  if (runtimeConfig.widgetPositions || runtimeConfig.widgetSizes || runtimeConfig.widgetZIndices) {
    applications = base.applications.map((app) => {
      const pos  = runtimeConfig.widgetPositions?.[app.id]
      const size = runtimeConfig.widgetSizes?.[app.id]
      const z    = runtimeConfig.widgetZIndices?.[app.id]
      if (!pos && !size && z === undefined) return app
      return {
        ...app,
        ...(pos  ? { windowPosition: pos }  : {}),
        ...(size ? { windowSize: size }      : {}),
        ...(z !== undefined ? { zIndexCurrent: z } : {}),
      }
    })
  }

  return mergeAppConfig({ ...base, applications }, runtimeConfig as unknown as Partial<AppConfig>)
}

export const DEFAULT_CONFIG: AppConfig = {
  windowPresets: [],
  scenes: {
    LOBBY: {
      id: 'LOBBY',
      label: 'LOBBY',
      backgroundOpaque: true,
      // Lobby = 3D room (R3F ThreeBackground renderer — NOT the Win98 desktop).
      // The desktop layer is hidden in LOBBY state; only the 3D room renders here.
      windows: [],
      style: {
        background: {
          type: 'gradient',
          color: '#f8fbff',
          gradient: 'linear-gradient(180deg, #ffffff 0%, #edf3ff 100%)',
          imageUrl: '',
          videoUrl: '',
          pattern: 'none',
          opacity: 1,
          blur: 0,
        },
        effects: {
          crt: false,
          noise: false,
          vignette: false,
          flicker: false,
          chromatic: false,
          scanlineOpacity: 0,
          noiseOpacity: 0,
          vignetteStrength: 0,
        },
        particles: {
          enabled: false,
          preset: 'none',
          density: 0.25,
          speed: 0.25,
        },
        fontFamily: 'default',
        accentColor: '#7fd0ff',
        textColor: '#18314d',
      },
      lobbyConfig: DEFAULT_LOBBY_CONFIG,
    },

    DESKTOP: {
      id: 'DESKTOP',
      label: 'DESKTOP',
      backgroundOpaque: true,
      showDesktop: true,
      // Desktop = Win98 OS widget lifecycle manager.
      // No background/particles — visual style lives in windows below.
      windows: [
        {
          id: '__desktop-effects',
          rendererType: 'builtin:effects',
          config: {
            crt: true,
            noise: false,
            vignette: true,
            flicker: false,
            chromatic: false,
            scanlineOpacity: 0.18,
            noiseOpacity: 0.06,
            vignetteStrength: 0.65,
          },
          position: { x: 0, y: 0, width: 1920, height: 1080 },
          zIndex: 0,
          visible: true,
        },
      ],
    },
  },

  applications: [
    { id: 'gallery',              label: 'GALLERY.exe',         icon: '🖼',   widgetSource: 'system' as const, widgetComponent: 'gallery' as const,              gallerySettings: { randomOrder: true, autoPlay: false, intervalSec: 8 } },
    { id: 'music',                label: 'MUSIC.exe',            icon: '🎵',   widgetSource: 'system' as const, widgetComponent: 'music' as const },
    { id: 'sticky-notes',         label: 'Sticky Notes',         icon: '📝',   widgetSource: 'system' as const, widgetComponent: 'sticky-notes' as const,         stickyNotesSettings: { ...DEFAULT_STICKY_NOTES_SETTINGS } },
    { id: 'chat',                 label: 'CHAT.exe',             icon: '💬',   widgetSource: 'system' as const, widgetComponent: 'chat' as const },
    { id: 'camera',               label: 'CAMERA.exe',           icon: '📷',   widgetSource: 'system' as const, widgetComponent: 'camera' as const },
    { id: 'cd-ripper',            label: 'CD Ripper',            icon: '💽',   widgetSource: 'system' as const, widgetComponent: 'cd-ripper' as const },
    { id: 'signal-lab',           label: 'Signal Lab',           icon: '📼',   widgetSource: 'system' as const, widgetComponent: 'signal-lab' as const },
    { id: 'broadcast-scheduler',  label: 'Broadcast Scheduler',  icon: '🗓️',  widgetSource: 'system' as const, widgetComponent: 'broadcast-scheduler' as const },
    { id: 'weather',              label: 'Weather Center',       icon: '🌦️',  widgetSource: 'system' as const, widgetComponent: 'weather-console' as const },
    { id: 'clock-tower',          label: 'Clock',                icon: '🕒',   widgetSource: 'system' as const, widgetComponent: 'clock-tower' as const },
    { id: 'newswire-desk',        label: 'Newswire Desk',        icon: '📰',   widgetSource: 'system' as const, widgetComponent: 'newswire-desk' as const },
    { id: 'city-nav',             label: 'City Navigator',       icon: '🗺️',  widgetSource: 'system' as const, widgetComponent: 'city-navigator' as const },
    { id: 'lcd-dolphins',         label: 'Pioneer LCD',          icon: '🐬',   widgetSource: 'system' as const, widgetComponent: 'lcd-dolphins' as const },
  ],

  keybinds: {
    obs: {
      F2: 'overlay:death',
      F3: 'overlay:revive',
      F4: 'overlay:victory',
      F6: 'scene:desktop',
      F7: 'scene:lobby',
    },
    admin: {
      F2: 'overlay:death',
      F3: 'overlay:revive',
      F4: 'overlay:victory',
      F6: 'scene:desktop',
      F7: 'scene:lobby',
    },
  },

  obs: {
    url: 'ws://localhost:4455',
    password: '',
  },

  audio: {
    masterVolume: 0.8,
    sfxVolume: 0.7,
    musicVolume: 0.4,
    ambientTrack: '',
    ambientVolume: 0.6,
    reactivity: {
      enabled: false,
      source: 'internal',
      sensitivity: 0.5,
      smoothing: 0.7,
    },
  },

  desktopConfig: DEFAULT_DESKTOP_CONFIG,

  desktopAmbiance: DEFAULT_DESKTOP_AMBIANCE_CONFIG,

  widgetLayouts: [],

  sourceEvents: [],

  sourceMedia: [],
  sourceTransitions: [],
}
