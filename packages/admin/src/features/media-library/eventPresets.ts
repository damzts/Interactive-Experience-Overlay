import {
  DEFAULT_DESKTOP_NOTIFICATION_DURATION_MS,
  DEFAULT_WIDGET_THEME_PRESETS,
} from '@ieomlabs/shared'
import type {
  DesktopNotificationEffectConfig,
  EffectConfig,
  EffectConfigMap,
  EffectType,
  EventAction,
  EventConfig,
} from '@ieomlabs/shared'

export type EventDef = EventConfig & {
  builtIn?: boolean
}

export const DEFAULT_EVENT_DEFS: EventDef[] = []

export const COMMON_EVENT_ACTION_KINDS: EventAction['kind'][] = [
  'desktop-config',
  'widget-themes',
  'widget-layout',
  'widget-command',
  'ambiance-patch',
]

export const EFFECT_CATEGORIES: { label: string; effects: EffectType[] }[] = [
  {
    label: 'Notifications',
    effects: [
      'desktop-notification',
      'notification-box',
      'terminal-toast',
      'achievement-unlock',
      'system-alert',
      'error-dialog',
      'friend-join',
    ],
  },
  {
    label: 'Screen Distortion',
    effects: [
      'screen-shake',
      'vignette-pulse',
      'static-burst',
      'vhs-glitch',
      'scan-lines-sweep',
      'neon-glow',
      'chromatic-aberration',
      'film-burn',
      'corruption-burst',
    ],
  },
  {
    label: 'Transitions',
    effects: [
      'network-glitch',
      'tv-off',
      'blue-screen',
      'pixel-transition',
      'dial-up-connect',
    ],
  },
  {
    label: 'Particles & Ambient',
    effects: [
      'floaties',
      'confetti-burst',
      'xp-gain',
      'fireworks',
      'aurora-wave',
      'starfall',
      'bubble-pop',
      'glitter-bomb',
      'laser-sweep',
      'typewriter',
    ],
  },
  {
    label: 'Animations',
    effects: [
      'death-overlay',
      'victory-overlay',
      'revive-overlay',
      'dvd-bounce',
      'level-up',
    ],
  },
  {
    label: 'Media',
    effects: ['image-overlay', 'video-overlay'],
  },
  {
    label: 'Audio',
    effects: ['audio-sfx'],
  },
  {
    label: 'Stream Personality',
    effects: [
      'cinema-moment',
      'chapter-reveal',
      'clip-that',
      'persona-shift',
      'moment-marker',
      'crowd-roar',
      'intermission',
    ],
  },
  {
    label: 'Cinematic',
    effects: [
      'shockwave',
      'hype-pulse',
      'countdown-burst',
      'spotlight',
      'chat-bubble',
    ],
  },
  {
    label: '2000s Internet',
    effects: [
      'aim-message',
      'msn-nudge',
      'xp-balloon',
      'geocities-alert',
      'buffering',
      'winamp-skip',
      'email-alert',
    ],
  },
  {
    label: 'Anime',
    effects: [
      'speed-lines',
      'impact-frame',
      'power-up-aura',
      'to-be-continued',
      'screentone-wipe',
      'sweat-drop',
      'dramatic-zoom',
    ],
  },
  {
    label: 'MMORPG / Retro-Futurist',
    effects: [
      'item-pickup',
      'quest-complete',
      'critical-hit',
      'boss-warning',
      'combo-multiplier',
      'game-over-effect',
      'matrix-glitch',
    ],
  },
]

export const EVENT_EFFECT_TYPES: EffectType[] = EFFECT_CATEGORIES.flatMap(c => c.effects)

export function getEventActionLabel(kind: EventAction['kind']) {
  if (kind === 'desktop-config') return 'Desktop look'
  if (kind === 'widget-themes') return 'Widget mood'
  if (kind === 'widget-layout') return 'Widget layout'
  if (kind === 'widget-command') return 'Widget state'
  return 'Ambiance'
}

export function describeEventSetup(def: EventDef) {
  if (def.actions?.length && def.effects.length) return 'Automation + overlay FX'
  if (def.actions?.length) return 'Runtime automation only'
  if (def.effects.length) return 'Overlay FX only'
  return 'Empty draft'
}

const DEFAULT_DESKTOP_NOTIFICATION_EFFECT_CONFIG: DesktopNotificationEffectConfig = {
  title: 'Desktop popup',
  body: 'This is a desktop notification event.',
  icon: '📣',
  durationMs: DEFAULT_DESKTOP_NOTIFICATION_DURATION_MS,
}

export function normalizeDesktopNotificationEffectConfig(
  cfg?: Partial<DesktopNotificationEffectConfig> | null,
): DesktopNotificationEffectConfig {
  return {
    ...DEFAULT_DESKTOP_NOTIFICATION_EFFECT_CONFIG,
    ...cfg,
  }
}

/** Default cfg for each effect type. A total record over EffectType — the
 *  compiler forces an entry here whenever a new effect type is added. */
const EFFECT_DRAFT_DEFAULTS: { [K in EffectType]: EffectConfigMap[K] } = {
  'desktop-notification': DEFAULT_DESKTOP_NOTIFICATION_EFFECT_CONFIG,
  'notification-box':   { title: 'System Notice', body: 'A notification box has been triggered.', icon: 'ℹ️', autoDismiss: 4 },
  'terminal-toast':     { messages: ['[ SYSTEM ] Draft event test', '[ STATUS ] Preview path active'], duration: 3, position: 'bottom-right' },
  'floaties':           { count: 18, duration: 4, speed: 1 },
  'corruption-burst':   { intensity: 'medium', duration: 1.4 },
  'network-glitch':     { message: '[ NETWORK INTERRUPTION ]', duration: 2 },
  'vignette-pulse':     { color: '#ff3b3b', opacity: 0.85, duration: 1.8, text: '' },
  'screen-shake':       { intensity: 'medium', duration: 0.8 },
  'typewriter':         { text: 'EVENT EXECUTED', position: 'center', color: '#8df6ff', fontSize: 48, duration: 2.6 },
  'static-burst':       { opacity: 0.9, duration: 0.9 },
  'image-overlay':      { src: '', opacity: 1, duration: 3 },
  'video-overlay':      { src: '', opacity: 1, duration: 0, loop: false },
  'death-overlay':      { speed: 1 },
  'victory-overlay':    { speed: 1 },
  'revive-overlay':     { speed: 1 },
  'achievement-unlock': { title: 'Achievement Unlocked', description: 'You did something great.', points: 10, icon: '🏆', durationMs: 4000 },
  'system-alert':       { title: 'Windows Security Alert', message: 'An unrecognized program is trying to access this computer.', durationMs: 4000 },
  'error-dialog':       { title: 'Application Error', message: 'The application has encountered an unexpected error and needs to close.', durationMs: 3500 },
  'friend-join':        { username: 'Player_001', tagline: 'has joined your session', durationMs: 3500 },
  'vhs-glitch':         { intensity: 'moderate', duration: 2 },
  'scan-lines-sweep':   { color: '#000000', opacity: 0.15, duration: 2 },
  'neon-glow':          { color: '#00ccff', intensity: 'medium', rainbow: false, duration: 3 },
  'chromatic-aberration': { intensity: 'moderate', duration: 1.5 },
  'film-burn':          { corner: 'tr', duration: 2.5 },
  'tv-off':             { duration: 1.2 },
  'blue-screen':        { errorCode: '0x0000007E', message: '(0xC0000005, 0xF741B367, 0xF78DA208, 0xF78D9F08)', duration: 4 },
  'pixel-transition':   { pixelSize: 20, duration: 2 },
  'dial-up-connect':    { isp: 'NetConnect ISP', speed: '56k', duration: 6 },
  'confetti-burst':     { colors: ['#ff0055', '#ffcc00', '#00ff88', '#00aaff', '#cc00ff'], count: 80, duration: 4 },
  'xp-gain':            { text: '+XP', count: 5, color: '#f5c400', fontSize: 36, duration: 2.5 },
  'fireworks':          { count: 4, colors: ['#ff0055', '#ffcc00', '#00ffcc', '#ff6600', '#cc00ff'], duration: 3.5 },
  'dvd-bounce':         { text: 'DVD', duration: 8 },
  'level-up':           { text: 'LEVEL UP', color: '#f5c400', duration: 3 },
  'audio-sfx':          { sfxId: 'transition', volume: 1 },
  'cinema-moment':      { text: 'THE CLUTCH', color: '#ffffff', duration: 4 },
  'chapter-reveal':     { number: 'I', title: 'THE BEGINNING', subtitle: '', duration: 4 },
  'clip-that':          { color: '#ff4444', durationMs: 3000 },
  'persona-shift':      { label: 'GRIND MODE: ON', color: '#00ff41', duration: 3 },
  'moment-marker':      { label: '★ MOMENT', color: '#f5c400', durationMs: 3500 },
  'crowd-roar':         { text: 'CROWD GOES WILD', duration: 3 },
  'intermission':       { message: 'Be Right Back', showTimer: true, duration: 30 },
  'shockwave':          { color: '#ffffff', thickness: 4, duration: 1.2 },
  'hype-pulse':         { duration: 4, speed: 'normal' },
  'countdown-burst':    { from: 3, color: '#ffffff' },
  'spotlight':          { duration: 5, radius: 280, color: 'rgba(255,255,220,0.15)' },
  'chat-bubble':        { text: 'Hello chat!', author: '', duration: 4, position: 'bottom' },
  'aim-message':        { username: 'NetBuddy420', message: 'yo that was insane lmaooo', durationMs: 4500 },
  'msn-nudge':          { username: 'xX_LiveBuddy_Xx', durationMs: 3500 },
  'xp-balloon':         { title: 'Windows has found new hardware', body: 'Click here to install the drivers for this device.', durationMs: 4000 },
  'geocities-alert':    { message: 'Welcome to MY STREAM!! Please sign my GUESTBOOK!! ⭐🌟⭐ This site is best viewed in 800x600!!', durationMs: 5000 },
  'buffering':          { quality: '360p', duration: 5 },
  'winamp-skip':        { track: 'In The End', artist: 'Linkin Park', durationMs: 4000 },
  'email-alert':        { subject: 'You have won a FREE iPod!!', sender: 'noreply@hotmail.com', durationMs: 4000 },
  'speed-lines':        { direction: 'out', color: '#ffffff', density: 48, duration: 1.5 },
  'impact-frame':       { text: '衝撃', color: '#ffffff', duration: 1.8 },
  'power-up-aura':      { color: '#f5c400', text: 'POWER LEVEL RISING', duration: 3.5 },
  'to-be-continued':    { duration: 4 },
  'screentone-wipe':    { duration: 2.5, opacity: 0.88 },
  'sweat-drop':         { durationMs: 3000, size: 'md' },
  'dramatic-zoom':      { zoomTo: 1.08, duration: 3, color: 'rgba(0,0,0,0.15)' },
  'item-pickup':        { itemName: 'Mystery Item', rarity: 'rare', durationMs: 2600 },
  'quest-complete':     { title: 'Quest Complete!', reward: '', duration: 3.5 },
  'critical-hit':       { text: 'CRITICAL HIT!', color: '#ff2222', durationMs: 900 },
  'boss-warning':       { text: 'WARNING', duration: 3 },
  'combo-multiplier':   { count: 8, durationMs: 2200 },
  'game-over-effect':   { text: 'GAME OVER', duration: 3.5 },
  'matrix-glitch':      { color: '#00ff41', duration: 2.5 },
  'aurora-wave':        { colors: ['#00ffc8', '#4488ff', '#cc44ff', '#ff44aa'], intensity: 'medium', duration: 6 },
  'starfall':           { count: 12, colors: ['#ffffff', '#8df6ff', '#ffe14a', '#ff88ff'], duration: 4 },
  'bubble-pop':         { count: 24, colors: ['#8df6ff', '#ff9ee7', '#b7ff9e', '#ffd88d', '#c49eff'], duration: 5 },
  'glitter-bomb':       { count: 160, colors: ['#ffd700', '#ff77ff', '#77e6ff', '#b0ff77', '#ffffff'], duration: 3 },
  'laser-sweep':        { color: '#ff00cc', rainbow: true, beams: 5, duration: 3.5 },
}

export function createEffectDraft(type: EffectType): EffectConfig {
  return { type, cfg: structuredClone(EFFECT_DRAFT_DEFAULTS[type]), delay: 0 } as EffectConfig
}

type LooseEffectConfig = { type: EffectType; cfg: Record<string, unknown>; delay?: number; sfx?: string }

export function normalizeEventEffectConfig(effect: EffectConfig): EffectConfig {
  const base = createEffectDraft(effect.type) as unknown as LooseEffectConfig
  const current = effect as unknown as LooseEffectConfig
  return {
    ...base,
    ...current,
    cfg: { ...base.cfg, ...current.cfg },
    delay: current.delay ?? base.delay ?? 0,
  } as unknown as EffectConfig
}

function createEventDef(): EventDef {
  return {
    id: 'custom-' + Date.now(),
    label: 'New Event',
    icon: '⚡',
    color: 'text-cyan-400',
    desc: '',
    effects: [],
    actions: [],
    auto: { enabled: false, mode: 'interval', intervalMin: 15, idleMin: 5, chance: 1, cooldownMin: 0 },
  }
}

export function createBlankEventDef(): EventDef {
  return createEventDef()
}

export function createEventActionDraft(kind: EventAction['kind']): EventAction {
  if (kind === 'desktop-config') {
    return {
      kind,
      timeoutSeconds: 30,
      patch: {
        theme: 'win98',
        iconAnimation: 'none',
        iconMotion: 1,
        widgetTheme: structuredClone(DEFAULT_WIDGET_THEME_PRESETS.metalheart),
      },
    }
  }

  if (kind === 'widget-themes') {
    return {
      kind,
      timeoutSeconds: 30,
      widgetIds: [],
      clearExisting: false,
      theme: structuredClone(DEFAULT_WIDGET_THEME_PRESETS.metalheart),
    }
  }

  if (kind === 'widget-layout') {
    return {
      kind,
      layoutId: '',
      timeoutSeconds: 30,
    }
  }

  if (kind === 'widget-command') {
    return {
      kind,
      widgetId: 'music',
      action: 'toggle',
    }
  }

  if (kind === 'scene-change') {
    return { kind, target: '' }
  }

  if (kind === 'transition') {
    return { kind, transitionId: 'fade' }
  }

  return {
    kind: 'ambiance-patch' as const,
    timeoutSeconds: 30,
    patch: {
      enabled: true,
      intervalSeconds: 30,
      maxOpenWidgets: 2,
      openWhileOneOpenChance: 0.35,
    },
  }
}
