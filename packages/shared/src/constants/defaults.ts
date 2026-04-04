import type {
  AppConfig,
  Application,
  DesktopAmbianceConfig,
  DesktopConfig,
  DesktopTheme,
  LobbyConfig,
  OverlayStyle,
  RecycleBinSettings,
  SourceWidgetSettings,
  StickyNotesSettings,
  WidgetThemeAnimation,
  WidgetThemeAtmosphere,
  WidgetThemeConfig,
  WidgetSkinTheme,
  WidgetComponentType,
  WidgetLayoutDefinition,
  WidgetLayoutItem,
  WidgetLayoutSource,
} from '../types/scene.js'
import { STATE, OVERLAY_EVENT } from '../types/state.js'

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
  ) {
    return theme
  }
  return 'metalheart'
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

function normalizeWidgetThemeIntensity(value: number | undefined, fallback: number) {
  if (!Number.isFinite(value)) return fallback
  return Math.min(3, Math.max(0, Math.round((value as number) * 100) / 100))
}

function buildSolidGradient(color: string) {
  return `linear-gradient(180deg, ${color} 0%, ${color} 100%)`
}

export const DEFAULT_STICKY_NOTES_SETTINGS: StickyNotesSettings = {
  text: 'Reminder:\n- queue scenes\n- test alerts\n- hydrate',
  color: '#fff2a8',
}

export const DEFAULT_WIDGET_THEME_PRESETS: Record<WidgetSkinTheme, WidgetThemeConfig> = {
  metalheart: {
    skin: 'metalheart',
    fontFamily: 'Audiowide',
    accentColor: '#ff5c8a',
    textColor: '#f8fbff',
    animation: 'shimmer',
    atmosphere: 'sparkle',
    motionIntensity: 0.95,
    glowIntensity: 1.2,
  },
  'genx soft club': {
    skin: 'genx soft club',
    fontFamily: 'Electrolize',
    accentColor: '#ff94d6',
    textColor: '#2c1430',
    animation: 'pulse',
    atmosphere: 'sparkle',
    motionIntensity: 1.15,
    glowIntensity: 0.85,
  },
  chromecore: {
    skin: 'chromecore',
    fontFamily: 'Rajdhani',
    accentColor: '#7fe0ff',
    textColor: '#152433',
    animation: 'shimmer',
    atmosphere: 'grid',
    motionIntensity: 0.8,
    glowIntensity: 0.95,
  },
  'y2k futurism': {
    skin: 'y2k futurism',
    fontFamily: 'Orbitron',
    accentColor: '#2cf7ff',
    textColor: '#ebfbff',
    animation: 'aurora',
    atmosphere: 'nebula',
    motionIntensity: 1.35,
    glowIntensity: 1.6,
  },
  transparent: {
    skin: 'transparent',
    fontFamily: 'Share Tech Mono',
    accentColor: '#b8f4ff',
    textColor: '#effcff',
    animation: 'broadcast',
    atmosphere: 'scanlines',
    motionIntensity: 1,
    glowIntensity: 1.05,
  },
  'aqua pop': {
    skin: 'aqua pop',
    fontFamily: 'Rajdhani',
    accentColor: '#4ddcff',
    textColor: '#08374c',
    animation: 'shimmer',
    atmosphere: 'sparkle',
    motionIntensity: 1.05,
    glowIntensity: 1.25,
  },
  'mallsoft pearl': {
    skin: 'mallsoft pearl',
    fontFamily: 'Electrolize',
    accentColor: '#ffb8e8',
    textColor: '#5a2b58',
    animation: 'aurora',
    atmosphere: 'nebula',
    motionIntensity: 0.9,
    glowIntensity: 1.15,
  },
  'messenger glow': {
    skin: 'messenger glow',
    fontFamily: 'Audiowide',
    accentColor: '#75ffb2',
    textColor: '#16352a',
    animation: 'pulse',
    atmosphere: 'grid',
    motionIntensity: 1.15,
    glowIntensity: 1,
  },
  'limewire plasma': {
    skin: 'limewire plasma',
    fontFamily: 'Share Tech Mono',
    accentColor: '#7aff54',
    textColor: '#e8ffe1',
    animation: 'broadcast',
    atmosphere: 'scanlines',
    motionIntensity: 1.35,
    glowIntensity: 1.45,
  },
  'cyber y2k': {
    skin: 'cyber y2k',
    fontFamily: 'Orbitron',
    accentColor: '#ff6dff',
    textColor: '#f4fbff',
    animation: 'aurora',
    atmosphere: 'grid',
    motionIntensity: 1.45,
    glowIntensity: 1.7,
  },
  'digital futurism': {
    skin: 'digital futurism',
    fontFamily: 'Audiowide',
    accentColor: '#56f0ff',
    textColor: '#eafcff',
    animation: 'shimmer',
    atmosphere: 'nebula',
    motionIntensity: 1.1,
    glowIntensity: 1.35,
  },
  'ssx rush': {
    skin: 'ssx rush',
    fontFamily: 'Rajdhani',
    accentColor: '#ff8e2b',
    textColor: '#fff7ee',
    animation: 'pulse',
    atmosphere: 'sparkle',
    motionIntensity: 1.55,
    glowIntensity: 1.2,
  },
  'ps2 drift': {
    skin: 'ps2 drift',
    fontFamily: 'Electrolize',
    accentColor: '#6ba4ff',
    textColor: '#edf3ff',
    animation: 'broadcast',
    atmosphere: 'grid',
    motionIntensity: 1.1,
    glowIntensity: 1.1,
  },
  'xbox blade': {
    skin: 'xbox blade',
    fontFamily: 'Share Tech Mono',
    accentColor: '#79ff5a',
    textColor: '#efffe7',
    animation: 'broadcast',
    atmosphere: 'scanlines',
    motionIntensity: 1.25,
    glowIntensity: 1.3,
  },
  'cel street': {
    skin: 'cel street',
    fontFamily: 'Audiowide',
    accentColor: '#ffd447',
    textColor: '#1a1f2f',
    animation: 'pulse',
    atmosphere: 'clean',
    motionIntensity: 1.2,
    glowIntensity: 0.9,
  },
  'aero nova': {
    skin: 'aero nova',
    fontFamily: 'Rajdhani',
    accentColor: '#59d7ff',
    textColor: '#103b58',
    animation: 'aurora',
    atmosphere: 'sparkle',
    motionIntensity: 1.05,
    glowIntensity: 1.45,
  },
  'aero opaline': {
    skin: 'aero opaline',
    fontFamily: 'Electrolize',
    accentColor: '#7ceee7',
    textColor: '#1a4960',
    animation: 'shimmer',
    atmosphere: 'nebula',
    motionIntensity: 0.95,
    glowIntensity: 1.25,
  },
}

export const DEFAULT_RECYCLE_BIN_SETTINGS: RecycleBinSettings = {
  emptyIcon: '🗑️',
  fullIcon: '🗑️',
}

export function withOverlayStyleDefaults(style: OverlayStyle | null | undefined, fallback: OverlayStyle): OverlayStyle {
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

export const DEFAULT_DESKTOP_CONFIG: DesktopConfig = {
  theme: 'win98',
  widgetTheme: { ...DEFAULT_WIDGET_THEME_PRESETS.metalheart },
  defaultIconSize: 'normal',
  autoArrangeIcons: false,
  iconAnimation: 'none',
  iconMotion: 0.45,
  widgetDefaultZIndices: {
    gallery: 0,
    browser: 0,
    music: 10,
    spotify: 10,
    archive: 20,
    'sticky-notes': 30,
    chat: 40,
    camera: 50,
  },
  widgetLayouts: [],
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

export const DEFAULT_WIDGET_WINDOW_SIZES: Record<string, { width: number; height: number }> = {
  music: { width: 280, height: 250 },
  spotify: { width: 280, height: 250 },
  archive: { width: 300, height: 260 },
  chat: { width: 280, height: 290 },
  'sticky-notes': { width: 260, height: 290 },
  gallery: { width: 430, height: 320 },
  browser: { width: 430, height: 320 },
  'desktop-pet': { width: 180, height: 180 },
  'aura-orb': { width: 220, height: 220 },
}

export const DEFAULT_WIDGET_DEFAULT_Z_INDICES = {
  ...DEFAULT_DESKTOP_CONFIG.widgetDefaultZIndices,
}

export const DEFAULT_SYSTEM_WIDGET_IDS = ['gallery', 'music', 'archive', 'sticky-notes', 'chat', 'camera', 'desktop-pet', 'aura-orb'] as const

const KNOWN_WIDGET_COMPONENTS_BY_ID: Record<string, Exclude<WidgetComponentType, 'generic'>> = {
  browser: 'gallery',
  gallery: 'gallery',
  music: 'music',
  spotify: 'music',
  archive: 'archive',
  chat: 'chat',
  'sticky-notes': 'sticky-notes',
  camera: 'camera',
  'desktop-pet': 'shimeji',
  'aura-orb': 'aura-orb',
}

const ALL_WIDGET_COMPONENT_TYPES = new Set<WidgetComponentType>([
  'archive',
  'camera',
  'chat',
  'gallery',
  'music',
  'source',
  'sticky-notes',
  'shimeji',
  'aura-orb',
  'generic',
])

const DEFAULT_WIDGET_COMPONENT_WINDOW_SIZES: Record<WidgetComponentType, { width: number; height: number }> = {
  archive: DEFAULT_WIDGET_WINDOW_SIZES.archive,
  camera: { width: 400, height: 300 },
  chat: DEFAULT_WIDGET_WINDOW_SIZES.chat,
  gallery: DEFAULT_WIDGET_WINDOW_SIZES.gallery,
  music: DEFAULT_WIDGET_WINDOW_SIZES.music,
  source: { width: 420, height: 320 },
  'sticky-notes': DEFAULT_WIDGET_WINDOW_SIZES['sticky-notes'],
  shimeji: DEFAULT_WIDGET_WINDOW_SIZES['desktop-pet'],
  'aura-orb': DEFAULT_WIDGET_WINDOW_SIZES['aura-orb'],
  generic: { width: 260, height: 240 },
}

const DEFAULT_WIDGET_COMPONENT_Z_INDICES: Record<WidgetComponentType, number> = {
  archive: DEFAULT_DESKTOP_CONFIG.widgetDefaultZIndices?.archive ?? 20,
  camera: DEFAULT_DESKTOP_CONFIG.widgetDefaultZIndices?.camera ?? 50,
  chat: DEFAULT_DESKTOP_CONFIG.widgetDefaultZIndices?.chat ?? 40,
  gallery: DEFAULT_DESKTOP_CONFIG.widgetDefaultZIndices?.gallery ?? 0,
  music: DEFAULT_DESKTOP_CONFIG.widgetDefaultZIndices?.music ?? 10,
  source: 25,
  'sticky-notes': DEFAULT_DESKTOP_CONFIG.widgetDefaultZIndices?.['sticky-notes'] ?? 30,
  shimeji: 75,
  'aura-orb': 65,
  generic: 0,
}

function isWidgetComponentType(value: unknown): value is WidgetComponentType {
  return typeof value === 'string' && ALL_WIDGET_COMPONENT_TYPES.has(value as WidgetComponentType)
}

function normalizeSourceWidgetSettings(settings?: SourceWidgetSettings | null): SourceWidgetSettings | undefined {
  if (!settings) return undefined

  const sceneId = typeof settings.sceneId === 'string' && settings.sceneId.trim()
    ? settings.sceneId.trim()
    : undefined
  const sourceId = typeof settings.sourceId === 'string' && settings.sourceId.trim()
    ? settings.sourceId.trim()
    : undefined

  if (!sceneId && !sourceId) return undefined

  return {
    ...(sceneId ? { sceneId } : {}),
    ...(sourceId ? { sourceId } : {}),
  }
}

function normalizeStickyNotesSettings(settings?: Partial<StickyNotesSettings> | null): StickyNotesSettings {
  return {
    ...DEFAULT_STICKY_NOTES_SETTINGS,
    ...settings,
  }
}

function normalizeRecycleBinSettings(settings?: Partial<RecycleBinSettings> | null): RecycleBinSettings {
  return {
    ...DEFAULT_RECYCLE_BIN_SETTINGS,
    ...settings,
  }
}

export function isSystemWidgetId(widgetId: string) {
  return (DEFAULT_SYSTEM_WIDGET_IDS as readonly string[]).includes(widgetId)
}

export function getWidgetSource(app: Pick<Application, 'id' | 'appType' | 'widgetSource'>): WidgetLayoutSource | undefined {
  if (app.appType !== 'widget') return undefined
  return isSystemWidgetId(app.id) ? 'system' : 'user'
}

export function getWidgetComponent(app: Pick<Application, 'id' | 'appType' | 'widgetComponent'>): WidgetComponentType | undefined {
  if (app.appType !== 'widget') return undefined
  if (KNOWN_WIDGET_COMPONENTS_BY_ID[app.id]) return KNOWN_WIDGET_COMPONENTS_BY_ID[app.id]
  if (isWidgetComponentType(app.widgetComponent) && app.widgetComponent !== 'generic') return app.widgetComponent
  if (/^camera(?:[-:_].+)?$/i.test(app.id)) return 'camera'
  if (/^source(?:[-:_].+)?$/i.test(app.id)) return 'source'
  if (isWidgetComponentType(app.widgetComponent)) return app.widgetComponent
  return 'generic'
}

export function isSystemWidget(app: Pick<Application, 'id' | 'appType' | 'widgetSource'>) {
  return getWidgetSource(app) === 'system'
}

export function getDefaultWidgetWindowSize(widgetId: string, widgetComponent?: WidgetComponentType) {
  return DEFAULT_WIDGET_WINDOW_SIZES[widgetId]
    ?? (widgetComponent ? DEFAULT_WIDGET_COMPONENT_WINDOW_SIZES[widgetComponent] : undefined)
    ?? DEFAULT_WIDGET_COMPONENT_WINDOW_SIZES.generic
}

export function getDefaultWidgetZIndex(widgetId: string, widgetComponent?: WidgetComponentType) {
  return DEFAULT_WIDGET_DEFAULT_Z_INDICES[widgetId as keyof typeof DEFAULT_WIDGET_DEFAULT_Z_INDICES]
    ?? (widgetComponent ? DEFAULT_WIDGET_COMPONENT_Z_INDICES[widgetComponent] : undefined)
    ?? DEFAULT_WIDGET_COMPONENT_Z_INDICES.generic
}

export function withApplicationDefaults(app: Application): Application {
  const next: Application = app.appType === 'widget'
    ? {
        ...app,
        widgetSource: getWidgetSource(app),
        widgetComponent: getWidgetComponent(app),
        sourceWidgetSettings: normalizeSourceWidgetSettings(app.sourceWidgetSettings),
      }
    : { ...app }

  if (next.id === 'sticky-notes' && next.appType === 'widget') {
    next.stickyNotesSettings = normalizeStickyNotesSettings(next.stickyNotesSettings)
  }

  if (next.id === 'recycle-bin' && next.appType === 'decoration') {
    next.recycleBinSettings = normalizeRecycleBinSettings(next.recycleBinSettings)
  }

  return next
}

export function withApplicationListDefaults(applications?: Application[] | null): Application[] {
  return (applications ?? []).map((app) => withApplicationDefaults(app))
}

export const DEFAULT_SYSTEM_WIDGET_LAYOUT_IDS = {
  cameraCorner: 'system-camera-corner',
  cameraPresentation: 'system-camera-presentation',
  cameraSourceACenter: 'system-camera-source-a-center',
  cameraSourceBCenter: 'system-camera-source-b-center',
  cameraDirectTalk: 'system-camera-direct-talk',
  cameraStage: 'system-camera-stage',
  cameraStage3up: 'system-camera-stage-3up',
} as const

const DEFAULT_WIDGET_LAYOUT_WORKAREA_HEIGHT = 1080 - 40
const DEFAULT_WIDGET_LAYOUT_MARGIN = 16
const DEFAULT_WIDGET_LAYOUT_PIP_WIDTH = 400
const DEFAULT_WIDGET_LAYOUT_PIP_HEIGHT = 300

function buildWidgetLayoutItem(config: {
  widgetId: string
  enabled: boolean
  x: number
  y: number
  width: number
  height: number
  focusPriority: number
}): WidgetLayoutItem {
  return {
    widgetId: config.widgetId,
    enabled: config.enabled,
    x: config.x,
    y: config.y,
    width: config.width,
    height: config.height,
    focusPriority: config.focusPriority,
  }
}

function buildWidgetLayoutDefinition(config: {
  id: string
  label: string
  icon: string
  description?: string
  source: WidgetLayoutSource
  items: WidgetLayoutItem[]
}): WidgetLayoutDefinition {
  return {
    id: config.id,
    label: config.label,
    icon: config.icon,
    description: config.description,
    source: config.source,
    items: config.items,
  }
}

function getDefaultCenteredStageRect() {
  const width = 1497
  const height = 811
  return {
    width,
    height,
    x: 211,
    y: 114,
  }
}

function getDefaultStageSize() {
  return {
    width: 1888,
    height: 1008,
  }
}

const DEFAULT_CENTERED_STAGE_RECT = getDefaultCenteredStageRect()
const DEFAULT_STAGE_SIZE = getDefaultStageSize()

export const DEFAULT_SYSTEM_WIDGET_LAYOUTS: WidgetLayoutDefinition[] = [
  buildWidgetLayoutDefinition({
    id: DEFAULT_SYSTEM_WIDGET_LAYOUT_IDS.cameraCorner,
    label: 'Camera: Bottom Right',
    icon: '📷',
    description: 'Host camera in the lower-right corner.',
    source: 'system',
    items: [
      buildWidgetLayoutItem({
        widgetId: 'camera',
        enabled: true,
        x: 1920 - DEFAULT_WIDGET_LAYOUT_PIP_WIDTH - DEFAULT_WIDGET_LAYOUT_MARGIN,
        y: DEFAULT_WIDGET_LAYOUT_WORKAREA_HEIGHT - DEFAULT_WIDGET_LAYOUT_PIP_HEIGHT - DEFAULT_WIDGET_LAYOUT_MARGIN,
        width: DEFAULT_WIDGET_LAYOUT_PIP_WIDTH,
        height: DEFAULT_WIDGET_LAYOUT_PIP_HEIGHT,
        focusPriority: 100,
      }),
    ],
  }),
  buildWidgetLayoutDefinition({
    id: DEFAULT_SYSTEM_WIDGET_LAYOUT_IDS.cameraPresentation,
    label: 'Presentation: Center + Host PiP',
    icon: '🖥',
    description: 'Secondary source centered with host camera pinned as PiP.',
    source: 'system',
    items: [
      buildWidgetLayoutItem({
        widgetId: 'camera-2',
        enabled: true,
        x: DEFAULT_CENTERED_STAGE_RECT.x,
        y: DEFAULT_CENTERED_STAGE_RECT.y,
        width: DEFAULT_CENTERED_STAGE_RECT.width,
        height: DEFAULT_CENTERED_STAGE_RECT.height,
        focusPriority: 100,
      }),
      buildWidgetLayoutItem({
        widgetId: 'camera',
        enabled: true,
        x: 1920 - DEFAULT_WIDGET_LAYOUT_PIP_WIDTH - DEFAULT_WIDGET_LAYOUT_MARGIN,
        y: DEFAULT_WIDGET_LAYOUT_WORKAREA_HEIGHT - DEFAULT_WIDGET_LAYOUT_PIP_HEIGHT - DEFAULT_WIDGET_LAYOUT_MARGIN,
        width: DEFAULT_WIDGET_LAYOUT_PIP_WIDTH,
        height: DEFAULT_WIDGET_LAYOUT_PIP_HEIGHT,
        focusPriority: 200,
      }),
      buildWidgetLayoutItem({
        widgetId: 'camera-3',
        enabled: false,
        x: DEFAULT_WIDGET_LAYOUT_MARGIN,
        y: DEFAULT_WIDGET_LAYOUT_MARGIN,
        width: DEFAULT_WIDGET_LAYOUT_PIP_WIDTH,
        height: DEFAULT_WIDGET_LAYOUT_PIP_HEIGHT,
        focusPriority: 150,
      }),
    ],
  }),
  buildWidgetLayoutDefinition({
    id: DEFAULT_SYSTEM_WIDGET_LAYOUT_IDS.cameraSourceACenter,
    label: 'Source A: Center + Host PiP',
    icon: '🅰',
    description: 'Camera-2 centered with host camera as PiP.',
    source: 'system',
    items: [
      buildWidgetLayoutItem({
        widgetId: 'camera-2',
        enabled: true,
        x: DEFAULT_CENTERED_STAGE_RECT.x,
        y: DEFAULT_CENTERED_STAGE_RECT.y,
        width: DEFAULT_CENTERED_STAGE_RECT.width,
        height: DEFAULT_CENTERED_STAGE_RECT.height,
        focusPriority: 100,
      }),
      buildWidgetLayoutItem({
        widgetId: 'camera',
        enabled: true,
        x: 1920 - DEFAULT_WIDGET_LAYOUT_PIP_WIDTH - DEFAULT_WIDGET_LAYOUT_MARGIN,
        y: DEFAULT_WIDGET_LAYOUT_WORKAREA_HEIGHT - DEFAULT_WIDGET_LAYOUT_PIP_HEIGHT - DEFAULT_WIDGET_LAYOUT_MARGIN,
        width: DEFAULT_WIDGET_LAYOUT_PIP_WIDTH,
        height: DEFAULT_WIDGET_LAYOUT_PIP_HEIGHT,
        focusPriority: 200,
      }),
      buildWidgetLayoutItem({
        widgetId: 'camera-3',
        enabled: false,
        x: DEFAULT_WIDGET_LAYOUT_MARGIN,
        y: DEFAULT_WIDGET_LAYOUT_MARGIN,
        width: DEFAULT_WIDGET_LAYOUT_PIP_WIDTH,
        height: DEFAULT_WIDGET_LAYOUT_PIP_HEIGHT,
        focusPriority: 150,
      }),
    ],
  }),
  buildWidgetLayoutDefinition({
    id: DEFAULT_SYSTEM_WIDGET_LAYOUT_IDS.cameraSourceBCenter,
    label: 'Source B: Center + Host PiP',
    icon: '🅱',
    description: 'Camera-3 centered with host camera as PiP.',
    source: 'system',
    items: [
      buildWidgetLayoutItem({
        widgetId: 'camera-3',
        enabled: true,
        x: DEFAULT_CENTERED_STAGE_RECT.x,
        y: DEFAULT_CENTERED_STAGE_RECT.y,
        width: DEFAULT_CENTERED_STAGE_RECT.width,
        height: DEFAULT_CENTERED_STAGE_RECT.height,
        focusPriority: 100,
      }),
      buildWidgetLayoutItem({
        widgetId: 'camera',
        enabled: true,
        x: 1920 - DEFAULT_WIDGET_LAYOUT_PIP_WIDTH - DEFAULT_WIDGET_LAYOUT_MARGIN,
        y: DEFAULT_WIDGET_LAYOUT_WORKAREA_HEIGHT - DEFAULT_WIDGET_LAYOUT_PIP_HEIGHT - DEFAULT_WIDGET_LAYOUT_MARGIN,
        width: DEFAULT_WIDGET_LAYOUT_PIP_WIDTH,
        height: DEFAULT_WIDGET_LAYOUT_PIP_HEIGHT,
        focusPriority: 200,
      }),
      buildWidgetLayoutItem({
        widgetId: 'camera-2',
        enabled: false,
        x: DEFAULT_WIDGET_LAYOUT_MARGIN,
        y: DEFAULT_WIDGET_LAYOUT_MARGIN,
        width: DEFAULT_WIDGET_LAYOUT_PIP_WIDTH,
        height: DEFAULT_WIDGET_LAYOUT_PIP_HEIGHT,
        focusPriority: 150,
      }),
    ],
  }),
  buildWidgetLayoutDefinition({
    id: DEFAULT_SYSTEM_WIDGET_LAYOUT_IDS.cameraDirectTalk,
    label: 'Direct Talk: Host Center',
    icon: '🎤',
    description: 'Host camera takes the full centered stage.',
    source: 'system',
    items: [
      buildWidgetLayoutItem({
        widgetId: 'camera',
        enabled: true,
        x: DEFAULT_CENTERED_STAGE_RECT.x,
        y: DEFAULT_CENTERED_STAGE_RECT.y,
        width: DEFAULT_CENTERED_STAGE_RECT.width,
        height: DEFAULT_CENTERED_STAGE_RECT.height,
        focusPriority: 100,
      }),
      buildWidgetLayoutItem({
        widgetId: 'camera-2',
        enabled: false,
        x: DEFAULT_WIDGET_LAYOUT_MARGIN,
        y: DEFAULT_WIDGET_LAYOUT_MARGIN,
        width: DEFAULT_WIDGET_LAYOUT_PIP_WIDTH,
        height: DEFAULT_WIDGET_LAYOUT_PIP_HEIGHT,
        focusPriority: 150,
      }),
      buildWidgetLayoutItem({
        widgetId: 'camera-3',
        enabled: false,
        x: DEFAULT_WIDGET_LAYOUT_MARGIN,
        y: DEFAULT_WIDGET_LAYOUT_MARGIN,
        width: DEFAULT_WIDGET_LAYOUT_PIP_WIDTH,
        height: DEFAULT_WIDGET_LAYOUT_PIP_HEIGHT,
        focusPriority: 150,
      }),
    ],
  }),
  buildWidgetLayoutDefinition({
    id: DEFAULT_SYSTEM_WIDGET_LAYOUT_IDS.cameraStage,
    label: 'Camera Stage + PiP',
    icon: '🎬',
    description: 'Primary stage with one PiP source camera.',
    source: 'system',
    items: [
      buildWidgetLayoutItem({
        widgetId: 'camera',
        enabled: true,
        x: DEFAULT_WIDGET_LAYOUT_MARGIN,
        y: DEFAULT_WIDGET_LAYOUT_MARGIN,
        width: DEFAULT_STAGE_SIZE.width,
        height: DEFAULT_STAGE_SIZE.height,
        focusPriority: 100,
      }),
      buildWidgetLayoutItem({
        widgetId: 'camera-2',
        enabled: true,
        x: 1920 - DEFAULT_WIDGET_LAYOUT_PIP_WIDTH - DEFAULT_WIDGET_LAYOUT_MARGIN,
        y: DEFAULT_WIDGET_LAYOUT_WORKAREA_HEIGHT - DEFAULT_WIDGET_LAYOUT_PIP_HEIGHT - DEFAULT_WIDGET_LAYOUT_MARGIN,
        width: DEFAULT_WIDGET_LAYOUT_PIP_WIDTH,
        height: DEFAULT_WIDGET_LAYOUT_PIP_HEIGHT,
        focusPriority: 200,
      }),
      buildWidgetLayoutItem({
        widgetId: 'camera-3',
        enabled: false,
        x: DEFAULT_WIDGET_LAYOUT_MARGIN,
        y: DEFAULT_WIDGET_LAYOUT_MARGIN,
        width: DEFAULT_WIDGET_LAYOUT_PIP_WIDTH,
        height: DEFAULT_WIDGET_LAYOUT_PIP_HEIGHT,
        focusPriority: 150,
      }),
    ],
  }),
  buildWidgetLayoutDefinition({
    id: DEFAULT_SYSTEM_WIDGET_LAYOUT_IDS.cameraStage3up,
    label: 'Camera Stage + 2x PiP',
    icon: '🧩',
    description: 'Primary stage with two PiP source cameras.',
    source: 'system',
    items: [
      buildWidgetLayoutItem({
        widgetId: 'camera',
        enabled: true,
        x: DEFAULT_WIDGET_LAYOUT_MARGIN,
        y: DEFAULT_WIDGET_LAYOUT_MARGIN,
        width: DEFAULT_STAGE_SIZE.width,
        height: DEFAULT_STAGE_SIZE.height,
        focusPriority: 100,
      }),
      buildWidgetLayoutItem({
        widgetId: 'camera-2',
        enabled: true,
        x: 1920 - DEFAULT_WIDGET_LAYOUT_PIP_WIDTH - DEFAULT_WIDGET_LAYOUT_MARGIN,
        y: DEFAULT_WIDGET_LAYOUT_WORKAREA_HEIGHT - DEFAULT_WIDGET_LAYOUT_PIP_HEIGHT - DEFAULT_WIDGET_LAYOUT_MARGIN,
        width: DEFAULT_WIDGET_LAYOUT_PIP_WIDTH,
        height: DEFAULT_WIDGET_LAYOUT_PIP_HEIGHT,
        focusPriority: 200,
      }),
      buildWidgetLayoutItem({
        widgetId: 'camera-3',
        enabled: true,
        x: DEFAULT_WIDGET_LAYOUT_MARGIN,
        y: DEFAULT_WIDGET_LAYOUT_WORKAREA_HEIGHT - DEFAULT_WIDGET_LAYOUT_PIP_HEIGHT - DEFAULT_WIDGET_LAYOUT_MARGIN,
        width: DEFAULT_WIDGET_LAYOUT_PIP_WIDTH,
        height: DEFAULT_WIDGET_LAYOUT_PIP_HEIGHT,
        focusPriority: 300,
      }),
    ],
  }),
]

export const DEFAULT_DESKTOP_NOTIFICATION_DURATION_MS = 6500
export const DEFAULT_DESKTOP_NOTIFICATION_MAX_VISIBLE = 3

function normalizeWidgetDimension(value: number | undefined, min: number, max: number) {
  if (!Number.isFinite(value)) return undefined
  const rounded = Math.round(value as number)
  return Math.min(max, Math.max(min, rounded))
}

function normalizeWidgetSizes(value?: DesktopConfig['widgetSizes']) {
  if (!value) return undefined
  const entries = Object.entries(value).reduce<Record<string, { width?: number; height?: number }>>((acc, [widgetId, size]) => {
    const width = normalizeWidgetDimension(size?.width, 180, 1400)
    const height = normalizeWidgetDimension(size?.height, 140, 1000)
    if (width === undefined && height === undefined) return acc
    acc[widgetId] = { width, height }
    return acc
  }, {})
  return Object.keys(entries).length ? entries : undefined
}

function normalizeWidgetZIndexMap(value?: Record<string, number>) {
  if (!value) return undefined
  const entries = Object.entries(value).reduce<Record<string, number>>((acc, [widgetId, zIndex]) => {
    if (!Number.isFinite(zIndex)) return acc
    acc[widgetId] = Math.max(0, Math.round(zIndex))
    return acc
  }, {})
  return Object.keys(entries).length ? entries : undefined
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

function normalizeWidgetLayouts(value?: DesktopConfig['widgetLayouts']) {
  const normalizedSourceLayouts = (value ?? []).reduce<WidgetLayoutDefinition[]>((acc, layout) => {
    const id = typeof layout.id === 'string' ? layout.id.trim() : ''
    const label = typeof layout.label === 'string' ? layout.label.trim() : ''
    if (!id || !label) return acc

    const items = normalizeWidgetLayoutItems(layout.items)
    if (items.length === 0) return acc

    acc.push({
      id,
      label,
      icon: typeof layout.icon === 'string' && layout.icon.trim() ? layout.icon.trim() : '📐',
      source: layout.source === 'system' ? 'system' : 'user',
      description: typeof layout.description === 'string' && layout.description.trim() ? layout.description.trim() : undefined,
      items,
    })
    return acc
  }, [])

  const defaultSystemLayouts = DEFAULT_SYSTEM_WIDGET_LAYOUTS.map((layout) => ({
    ...layout,
    items: normalizeWidgetLayoutItems(layout.items),
  }))
  const systemLayoutIds = new Set(defaultSystemLayouts.map((layout) => layout.id))
  const mergedById = new Map(defaultSystemLayouts.map((layout) => [layout.id, layout]))

  for (const layout of normalizedSourceLayouts) {
    if (systemLayoutIds.has(layout.id)) {
      mergedById.set(layout.id, { ...layout, source: 'system' })
    } else {
      mergedById.set(layout.id, layout)
    }
  }

  return [
    ...defaultSystemLayouts
      .map((layout) => mergedById.get(layout.id))
      .filter((layout): layout is WidgetLayoutDefinition => !!layout),
    ...normalizedSourceLayouts
      .filter((layout) => !systemLayoutIds.has(layout.id))
      .map((layout) => mergedById.get(layout.id))
      .filter((layout): layout is WidgetLayoutDefinition => !!layout),
  ]
}

export function withDesktopConfigDefaults(config?: Partial<DesktopConfig> | null): DesktopConfig {
  const source = (config ?? {}) as Partial<DesktopConfig> & {
    notifications?: unknown
    stickyNotes?: Partial<StickyNotesSettings> | null
    recycleBin?: Partial<DesktopConfig['recycleBin']> & Partial<RecycleBinSettings>
  }
  const { notifications: _legacyNotifications, stickyNotes: _legacyStickyNotes, ...rest } = source
  const legacyRecycleBin: Partial<DesktopConfig['recycleBin']> & Partial<RecycleBinSettings> = source.recycleBin ?? {}
  const { emptyIcon: _legacyEmptyIcon, fullIcon: _legacyFullIcon, ...recycleBin } = legacyRecycleBin
  const widgetSkin = normalizeWidgetSkinTheme(source.widgetTheme?.skin)
  const widgetPreset = DEFAULT_WIDGET_THEME_PRESETS[widgetSkin]

  return {
    ...DEFAULT_DESKTOP_CONFIG,
    ...rest,
    theme: normalizeDesktopTheme(source.theme as DesktopTheme | 'win vista' | undefined),
    widgetTheme: {
      ...widgetPreset,
      ...source.widgetTheme,
      skin: widgetSkin,
      animation: normalizeWidgetThemeAnimation(source.widgetTheme?.animation ?? widgetPreset.animation),
      atmosphere: normalizeWidgetThemeAtmosphere(source.widgetTheme?.atmosphere ?? widgetPreset.atmosphere),
      motionIntensity: normalizeWidgetThemeIntensity(source.widgetTheme?.motionIntensity, widgetPreset.motionIntensity),
      glowIntensity: normalizeWidgetThemeIntensity(source.widgetTheme?.glowIntensity, widgetPreset.glowIntensity),
    },
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
    widgetSizes: normalizeWidgetSizes(source.widgetSizes),
    widgetDefaultZIndices: normalizeWidgetZIndexMap({
      ...(DEFAULT_DESKTOP_CONFIG.widgetDefaultZIndices ?? {}),
      ...(source.widgetDefaultZIndices ?? {}),
    }),
    widgetZIndices: normalizeWidgetZIndexMap(source.widgetZIndices),
    widgetLayouts: normalizeWidgetLayouts(source.widgetLayouts),
  }
}

export const DEFAULT_DESKTOP_AMBIANCE_CONFIG: DesktopAmbianceConfig = {
  widgetSimulation: {
    enabled: false,
    intervalSeconds: 30,
    maxOpenWidgets: 2,
    openWhileOneOpenChance: 0.35,
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

export const DEFAULT_CONFIG: AppConfig = {
  scenes: {
    LOBBY: {
      id: 'LOBBY',
      label: 'LOBBY',
      backgroundOpaque: true,
      // Lobby = 3D room (R3F ThreeBackground plugin — NOT the Win98 desktop).
      // The desktop layer is hidden in LOBBY state; only the 3D room renders here.
      sources: [],
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
      // Desktop = Win98 OS layer (shown via #desktop-layer CSS, not a source plugin).
      // Sources layer is empty — the desktop canvas owns this state visually.
      sources: [],
      style: {
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
      },
    },
  },

  applications: [
    {
      id: 'recycle-bin',
      label: 'Recycle Bin',
      icon: '🗑️',
      recycleBinSettings: { ...DEFAULT_RECYCLE_BIN_SETTINGS },
      appType: 'decoration' as const,
      targetSceneId: STATE.DESKTOP,
      transitionType: 'instant',
      iconPosition: { x: 16, y: 16 },
      iconSize: 'normal' as const,
    },
    {
      id: 'gallery',
      label: 'GALLERY.exe',
      icon: '🖼',
      appType: 'widget' as const,
      targetSceneId: STATE.DESKTOP,
      widgetSource: 'system' as const,
      widgetComponent: 'gallery' as const,
      transitionType: 'instant',
      iconPosition: { x: 16, y: 96 },
      iconSize: 'normal' as const,
      gallerySettings: {
        randomOrder: true,
        autoPlay: false,
        intervalSec: 8,
      },
    },
    {
      id: 'music',
      label: 'MUSIC.exe',
      icon: '🎵',
      appType: 'widget' as const,
      targetSceneId: STATE.DESKTOP,
      widgetSource: 'system' as const,
      widgetComponent: 'music' as const,
      transitionType: 'instant',
      iconPosition: { x: 16, y: 176 },
      iconSize: 'normal' as const,
    },
    {
      id: 'archive',
      label: 'ARCHIVE.exe',
      icon: '📖',
      appType: 'widget' as const,
      targetSceneId: STATE.DESKTOP,
      widgetSource: 'system' as const,
      widgetComponent: 'archive' as const,
      transitionType: 'instant',
      iconPosition: { x: 16, y: 256 },
      iconSize: 'normal' as const,
    },
    {
      id: 'sticky-notes',
      label: 'Sticky Notes',
      icon: '📝',
      stickyNotesSettings: { ...DEFAULT_STICKY_NOTES_SETTINGS },
      appType: 'widget' as const,
      targetSceneId: STATE.DESKTOP,
      widgetSource: 'system' as const,
      widgetComponent: 'sticky-notes' as const,
      transitionType: 'instant',
      iconPosition: { x: 16, y: 336 },
      iconSize: 'normal' as const,
    },
    {
      id: 'chat',
      label: 'CHAT.exe',
      icon: '💬',
      appType: 'widget' as const,
      targetSceneId: STATE.DESKTOP,
      widgetSource: 'system' as const,
      widgetComponent: 'chat' as const,
      transitionType: 'instant',
      iconPosition: { x: 16, y: 416 },
      iconSize: 'normal' as const,
    },
    {
      id: 'camera',
      label: 'CAMERA.exe',
      icon: '📷',
      appType: 'widget' as const,
      targetSceneId: STATE.DESKTOP,
      widgetSource: 'system' as const,
      widgetComponent: 'camera' as const,
      transitionType: 'instant',
      iconPosition: { x: 16, y: 496 },
      iconSize: 'normal' as const,
    },
    {
      id: 'desktop-pet',
      label: 'Shimeji Buddy',
      icon: '🐾',
      appType: 'widget' as const,
      targetSceneId: STATE.DESKTOP,
      widgetSource: 'system' as const,
      widgetComponent: 'shimeji' as const,
      transitionType: 'instant',
      iconPosition: { x: 16, y: 576 },
      iconSize: 'normal' as const,
    },
    {
      id: 'aura-orb',
      label: 'Aura Orb',
      icon: '🫧',
      appType: 'widget' as const,
      targetSceneId: STATE.DESKTOP,
      widgetSource: 'system' as const,
      widgetComponent: 'aura-orb' as const,
      transitionType: 'instant',
      iconPosition: { x: 16, y: 656 },
      iconSize: 'normal' as const,
    },
  ],

  keybinds: {
    obs: {
      F2: 'overlay:death',
      F3: 'overlay:revive',
      F4: 'overlay:victory',
      F6: 'scene:desktop',
      F7: 'scene:lobby',
      Escape: 'panic',
    },
    admin: {
      F2: 'overlay:death',
      F3: 'overlay:revive',
      F4: 'overlay:victory',
      F6: 'scene:desktop',
      F7: 'scene:lobby',
      Escape: 'panic',
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
  },

  overlayStyle: {
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
  },

  desktopConfig: DEFAULT_DESKTOP_CONFIG,

  desktopAmbiance: DEFAULT_DESKTOP_AMBIANCE_CONFIG,

  events: [
    { id: OVERLAY_EVENT.DEATH,          label: 'DEATH',    icon: '💀', color: 'text-red-400',     desc: 'Red vignette + YOU DIED',           effects: [{ type: 'death-overlay',   cfg: {} }], auto: { enabled: false, mode: 'interval', intervalMin: 20, idleMin: 5 } },
    { id: OVERLAY_EVENT.VICTORY,        label: 'VICTORY',  icon: '🏆', color: 'text-yellow-400',  desc: 'Win98 dialog: MISSION.LOG saved',   effects: [{ type: 'victory-overlay', cfg: {} }], auto: { enabled: false, mode: 'interval', intervalMin: 30, idleMin: 5 } },
    { id: OVERLAY_EVENT.REVIVE,         label: 'REVIVE',   icon: '❤',  color: 'text-emerald-400', desc: 'Terminal: Restarting process...',   effects: [{ type: 'revive-overlay',  cfg: {} }], auto: { enabled: false, mode: 'interval', intervalMin: 25, idleMin: 5 } },
    { id: OVERLAY_EVENT.NETWORK_GLITCH, label: 'GLITCH',   icon: '📡', color: 'text-purple-400',  desc: 'Full-screen artifact burst',        effects: [{ type: 'network-glitch',  cfg: { message: '[ NETWORK INTERRUPTION ]', duration: 2 } }], auto: { enabled: false, mode: 'interval', intervalMin: 15, idleMin: 5 } },
    { id: 'idle-floaties',              label: 'FLOATIES', icon: '✨',  color: 'text-cyan-400',    desc: 'Glowing symbols drift over screen', effects: [{ type: 'floaties',         cfg: { count: 10, duration: 10, speed: 1.0 } }], auto: { enabled: false, mode: 'idle',     intervalMin: 15, idleMin: 5 } },
  ],

  mediaLibrary: [],
}
