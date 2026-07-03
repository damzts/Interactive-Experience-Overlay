import {
  DEFAULT_DESKTOP_NOTIFICATION_DURATION_MS,
  DEFAULT_WIDGET_THEME_PRESETS,
} from '@ieomlabs/shared'
import type {
  DesktopNotificationEffectConfig,
  EffectConfig,
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

export function createEffectDraft(type: EffectType): EffectConfig {
  if (type === 'desktop-notification') {
    return {
      type,
      cfg: structuredClone(DEFAULT_DESKTOP_NOTIFICATION_EFFECT_CONFIG),
      delay: 0,
    }
  }

  if (type === 'notification-box') {
    return {
      type,
      cfg: {
        title: 'System Notice',
        body: 'A notification box has been triggered.',
        icon: 'ℹ️',
        autoDismiss: 4,
      },
      delay: 0,
    }
  }

  if (type === 'terminal-toast') {
    return {
      type,
      cfg: {
        messages: ['[ SYSTEM ] Draft event test', '[ STATUS ] Preview path active'],
        duration: 3,
        position: 'bottom-right',
      },
      delay: 0,
    }
  }

  if (type === 'floaties') {
    return {
      type,
      cfg: { count: 18, duration: 4, speed: 1 },
      delay: 0,
    }
  }

  if (type === 'corruption-burst') {
    return {
      type,
      cfg: { intensity: 'medium', duration: 1.4 },
      delay: 0,
    }
  }

  if (type === 'network-glitch') {
    return {
      type,
      cfg: { message: '[ NETWORK INTERRUPTION ]', duration: 2 },
      delay: 0,
    }
  }

  if (type === 'vignette-pulse') {
    return {
      type,
      cfg: { color: '#ff3b3b', opacity: 0.85, duration: 1.8, text: '' },
      delay: 0,
    }
  }

  if (type === 'screen-shake') {
    return {
      type,
      cfg: { intensity: 'medium', duration: 0.8 },
      delay: 0,
    }
  }

  if (type === 'typewriter') {
    return {
      type,
      cfg: { text: 'EVENT EXECUTED', position: 'center', color: '#8df6ff', fontSize: 48, duration: 2.6 },
      delay: 0,
    }
  }

  if (type === 'static-burst') {
    return {
      type,
      cfg: { opacity: 0.9, duration: 0.9 },
      delay: 0,
    }
  }

  if (type === 'image-overlay') {
    return {
      type,
      cfg: { src: '', opacity: 1, duration: 3 },
      delay: 0,
    }
  }

  if (type === 'video-overlay') {
    return {
      type,
      cfg: { src: '', opacity: 1, duration: 0, loop: false },
      delay: 0,
    }
  }

  if (type === 'death-overlay' || type === 'victory-overlay' || type === 'revive-overlay') {
    return { type, cfg: { speed: 1 }, delay: 0 } as EffectConfig
  }

  // ── New effects ─────────────────────────────────────────────────

  if (type === 'achievement-unlock') {
    return {
      type,
      cfg: { title: 'Achievement Unlocked', description: 'You did something great.', points: 10, icon: '🏆', durationMs: 4000 },
      delay: 0,
    }
  }

  if (type === 'system-alert') {
    return {
      type,
      cfg: { title: 'Windows Security Alert', message: 'An unrecognized program is trying to access this computer.', durationMs: 4000 },
      delay: 0,
    }
  }

  if (type === 'error-dialog') {
    return {
      type,
      cfg: { title: 'Application Error', message: 'The application has encountered an unexpected error and needs to close.', durationMs: 3500 },
      delay: 0,
    }
  }

  if (type === 'friend-join') {
    return {
      type,
      cfg: { username: 'Player_001', tagline: 'has joined your session', durationMs: 3500 },
      delay: 0,
    }
  }

  if (type === 'vhs-glitch') {
    return {
      type,
      cfg: { intensity: 'moderate', duration: 2 },
      delay: 0,
    }
  }

  if (type === 'scan-lines-sweep') {
    return {
      type,
      cfg: { color: '#000000', opacity: 0.15, duration: 2 },
      delay: 0,
    }
  }

  if (type === 'neon-glow') {
    return {
      type,
      cfg: { color: '#00ccff', intensity: 'medium', rainbow: false, duration: 3 },
      delay: 0,
    }
  }

  if (type === 'chromatic-aberration') {
    return {
      type,
      cfg: { intensity: 'moderate', duration: 1.5 },
      delay: 0,
    }
  }

  if (type === 'film-burn') {
    return {
      type,
      cfg: { corner: 'tr', duration: 2.5 },
      delay: 0,
    }
  }

  if (type === 'tv-off') {
    return {
      type,
      cfg: { duration: 1.2 },
      delay: 0,
    }
  }

  if (type === 'blue-screen') {
    return {
      type,
      cfg: { errorCode: '0x0000007E', message: '(0xC0000005, 0xF741B367, 0xF78DA208, 0xF78D9F08)', duration: 4 },
      delay: 0,
    }
  }

  if (type === 'pixel-transition') {
    return {
      type,
      cfg: { pixelSize: 20, duration: 2 },
      delay: 0,
    }
  }

  if (type === 'dial-up-connect') {
    return {
      type,
      cfg: { isp: 'NetConnect ISP', speed: '56k', duration: 6 },
      delay: 0,
    }
  }

  if (type === 'confetti-burst') {
    return {
      type,
      cfg: { colors: ['#ff0055', '#ffcc00', '#00ff88', '#00aaff', '#cc00ff'], count: 80, duration: 4 },
      delay: 0,
    }
  }

  if (type === 'xp-gain') {
    return {
      type,
      cfg: { text: '+XP', count: 5, color: '#f5c400', fontSize: 36, duration: 2.5 },
      delay: 0,
    }
  }

  if (type === 'fireworks') {
    return {
      type,
      cfg: { count: 4, colors: ['#ff0055', '#ffcc00', '#00ffcc', '#ff6600', '#cc00ff'], duration: 3.5 },
      delay: 0,
    }
  }

  if (type === 'dvd-bounce') {
    return {
      type,
      cfg: { text: 'DVD', duration: 8 },
      delay: 0,
    }
  }

  if (type === 'level-up') {
    return {
      type,
      cfg: { text: 'LEVEL UP', color: '#f5c400', duration: 3 },
      delay: 0,
    }
  }

  if (type === 'audio-sfx') {
    return {
      type,
      cfg: { sfxId: 'transition', volume: 1 },
      delay: 0,
    }
  }

  // ── Stream personality effects ───────────────────────────────────

  if (type === 'cinema-moment') {
    return {
      type,
      cfg: { text: 'THE CLUTCH', color: '#ffffff', duration: 4 },
      delay: 0,
    }
  }

  if (type === 'chapter-reveal') {
    return {
      type,
      cfg: { number: 'I', title: 'THE BEGINNING', subtitle: '', duration: 4 },
      delay: 0,
    }
  }

  if (type === 'clip-that') {
    return {
      type,
      cfg: { color: '#ff4444', durationMs: 3000 },
      delay: 0,
    }
  }

  if (type === 'persona-shift') {
    return {
      type,
      cfg: { label: 'GRIND MODE: ON', color: '#00ff41', duration: 3 },
      delay: 0,
    }
  }

  if (type === 'moment-marker') {
    return {
      type,
      cfg: { label: '★ MOMENT', color: '#f5c400', durationMs: 3500 },
      delay: 0,
    }
  }

  if (type === 'crowd-roar') {
    return {
      type,
      cfg: { text: 'CROWD GOES WILD', duration: 3 },
      delay: 0,
    }
  }

  if (type === 'intermission') {
    return {
      type,
      cfg: { message: 'Be Right Back', showTimer: true, duration: 30 },
      delay: 0,
    }
  }

  if (type === 'shockwave') {
    return {
      type,
      cfg: { color: '#ffffff', thickness: 4, duration: 1.2 },
      delay: 0,
    }
  }

  if (type === 'hype-pulse') {
    return {
      type,
      cfg: { duration: 4, speed: 'normal' },
      delay: 0,
    }
  }

  if (type === 'countdown-burst') {
    return {
      type,
      cfg: { from: 3, color: '#ffffff' },
      delay: 0,
    }
  }

  if (type === 'spotlight') {
    return {
      type,
      cfg: { duration: 5, radius: 280, color: 'rgba(255,255,220,0.15)' },
      delay: 0,
    }
  }

  if (type === 'chat-bubble') {
    return {
      type,
      cfg: { text: 'Hello chat!', author: '', duration: 4, position: 'bottom' },
      delay: 0,
    }
  }

  // ── 2000s Internet Nostalgia ──────────────────────────────────

  if (type === 'aim-message') {
    return {
      type,
      cfg: { username: 'NetBuddy420', message: 'yo that was insane lmaooo', durationMs: 4500 },
      delay: 0,
    }
  }

  if (type === 'msn-nudge') {
    return {
      type,
      cfg: { username: 'xX_LiveBuddy_Xx', durationMs: 3500 },
      delay: 0,
    }
  }

  if (type === 'xp-balloon') {
    return {
      type,
      cfg: { title: 'Windows has found new hardware', body: 'Click here to install the drivers for this device.', durationMs: 4000 },
      delay: 0,
    }
  }

  if (type === 'geocities-alert') {
    return {
      type,
      cfg: { message: 'Welcome to MY STREAM!! Please sign my GUESTBOOK!! ⭐🌟⭐ This site is best viewed in 800x600!!', durationMs: 5000 },
      delay: 0,
    }
  }

  if (type === 'buffering') {
    return {
      type,
      cfg: { quality: '360p', duration: 5 },
      delay: 0,
    }
  }

  if (type === 'winamp-skip') {
    return {
      type,
      cfg: { track: 'In The End', artist: 'Linkin Park', durationMs: 4000 },
      delay: 0,
    }
  }

  if (type === 'email-alert') {
    return {
      type,
      cfg: { subject: 'You have won a FREE iPod!!', sender: 'noreply@hotmail.com', durationMs: 4000 },
      delay: 0,
    }
  }

  // ── Anime ─────────────────────────────────────────────────────

  if (type === 'speed-lines') {
    return {
      type,
      cfg: { direction: 'out', color: '#ffffff', density: 48, duration: 1.5 },
      delay: 0,
    }
  }

  if (type === 'impact-frame') {
    return {
      type,
      cfg: { text: '衝撃', color: '#ffffff', duration: 1.8 },
      delay: 0,
    }
  }

  if (type === 'power-up-aura') {
    return {
      type,
      cfg: { color: '#f5c400', text: 'POWER LEVEL RISING', duration: 3.5 },
      delay: 0,
    }
  }

  if (type === 'to-be-continued') {
    return {
      type,
      cfg: { duration: 4 },
      delay: 0,
    }
  }

  if (type === 'screentone-wipe') {
    return {
      type,
      cfg: { duration: 2.5, opacity: 0.88 },
      delay: 0,
    }
  }

  if (type === 'sweat-drop') {
    return {
      type,
      cfg: { durationMs: 3000, size: 'md' },
      delay: 0,
    }
  }

  if (type === 'dramatic-zoom') {
    return {
      type,
      cfg: { zoomTo: 1.08, duration: 3, color: 'rgba(0,0,0,0.15)' },
      delay: 0,
    }
  }

  if (type === 'item-pickup') {
    return {
      type,
      cfg: { itemName: 'Mystery Item', rarity: 'rare', durationMs: 2600 },
      delay: 0,
    }
  }

  if (type === 'quest-complete') {
    return {
      type,
      cfg: { title: 'Quest Complete!', reward: '', duration: 3.5 },
      delay: 0,
    }
  }

  if (type === 'critical-hit') {
    return {
      type,
      cfg: { text: 'CRITICAL HIT!', color: '#ff2222', durationMs: 900 },
      delay: 0,
    }
  }

  if (type === 'boss-warning') {
    return {
      type,
      cfg: { text: 'WARNING', duration: 3 },
      delay: 0,
    }
  }

  if (type === 'combo-multiplier') {
    return {
      type,
      cfg: { count: 8, durationMs: 2200 },
      delay: 0,
    }
  }

  if (type === 'game-over-effect') {
    return {
      type,
      cfg: { text: 'GAME OVER', duration: 3.5 },
      delay: 0,
    }
  }

  if (type === 'matrix-glitch') {
    return {
      type,
      cfg: { color: '#00ff41', duration: 2.5 },
      delay: 0,
    }
  }

  if (type === 'aurora-wave') {
    return {
      type,
      cfg: { colors: ['#00ffc8', '#4488ff', '#cc44ff', '#ff44aa'], intensity: 'medium', duration: 6 },
      delay: 0,
    }
  }

  if (type === 'starfall') {
    return {
      type,
      cfg: { count: 12, colors: ['#ffffff', '#8df6ff', '#ffe14a', '#ff88ff'], duration: 4 },
      delay: 0,
    }
  }

  if (type === 'bubble-pop') {
    return {
      type,
      cfg: { count: 24, colors: ['#8df6ff', '#ff9ee7', '#b7ff9e', '#ffd88d', '#c49eff'], duration: 5 },
      delay: 0,
    }
  }

  if (type === 'glitter-bomb') {
    return {
      type,
      cfg: { count: 160, colors: ['#ffd700', '#ff77ff', '#77e6ff', '#b0ff77', '#ffffff'], duration: 3 },
      delay: 0,
    }
  }

  if (type === 'laser-sweep') {
    return {
      type,
      cfg: { color: '#ff00cc', rainbow: true, beams: 5, duration: 3.5 },
      delay: 0,
    }
  }

  return { type, cfg: {}, delay: 0 } as EffectConfig
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
