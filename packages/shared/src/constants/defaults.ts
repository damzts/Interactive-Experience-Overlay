import type { AppConfig, DesktopAmbianceConfig, DesktopConfig, DesktopTheme, LobbyConfig, OverlayStyle } from '../types/scene.js'
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

function buildSolidGradient(color: string) {
  return `linear-gradient(180deg, ${color} 0%, ${color} 100%)`
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
  defaultIconSize: 'normal',
  autoArrangeIcons: false,
  iconAnimation: 'none',
  iconMotion: 0.45,
  recycleBin: {
    emptyIcon: '🗑️',
    fullIcon: '🗑️',
    fullOnStart: false,
  },
  stickyNotes: {
    text: 'Reminder:\n- queue scenes\n- test alerts\n- hydrate',
    color: '#fff2a8',
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
}

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

export function withDesktopConfigDefaults(config?: Partial<DesktopConfig> | null): DesktopConfig {
  const source = (config ?? {}) as Partial<DesktopConfig> & { notifications?: unknown }
  const { notifications: _legacyNotifications, ...rest } = source

  return {
    ...DEFAULT_DESKTOP_CONFIG,
    ...rest,
    theme: normalizeDesktopTheme(source.theme as DesktopTheme | 'win vista' | undefined),
    recycleBin: {
      ...DEFAULT_DESKTOP_CONFIG.recycleBin,
      ...source.recycleBin,
    },
    stickyNotes: {
      ...DEFAULT_DESKTOP_CONFIG.stickyNotes,
      ...source.stickyNotes,
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
      transitionType: 'instant',
      iconPosition: { x: 16, y: 256 },
      iconSize: 'normal' as const,
    },
    {
      id: 'sticky-notes',
      label: 'Sticky Notes',
      icon: '📝',
      appType: 'widget' as const,
      targetSceneId: STATE.DESKTOP,
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
      transitionType: 'instant',
      iconPosition: { x: 16, y: 496 },
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
