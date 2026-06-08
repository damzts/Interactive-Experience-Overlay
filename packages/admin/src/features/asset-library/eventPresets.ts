import {
  DEFAULT_DESKTOP_NOTIFICATION_DURATION_MS,
  DEFAULT_WIDGET_THEME_PRESETS,
  STATE,
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

export type EventPresetId = 'blank' | 'signal-burst' | 'theme-shift' | 'widget-mood' | 'layout-recall' | 'ambiance-boost'

export const DEFAULT_EVENT_DEFS: EventDef[] = []

export const EVENT_PRESET_OPTIONS: Array<{
  id: EventPresetId
  icon: string
  label: string
  description: string
}> = [
  { id: 'blank', icon: '⚡', label: 'Blank Event', description: 'Start from scratch with an empty event record.' },
  { id: 'signal-burst', icon: '📡', label: 'Signal Burst', description: 'Desktop notification plus glitch-style overlay burst.' },
  { id: 'theme-shift', icon: '🎨', label: 'Theme Shift', description: 'Swap the desktop and shared widget chrome into a new mood.' },
  { id: 'widget-mood', icon: '🪟', label: 'Widget Mood', description: 'Restyle one or more widgets without changing the whole desktop.' },
  { id: 'layout-recall', icon: '🗂', label: 'Layout Recall', description: 'Snap the live desktop into a saved widget layout.' },
  { id: 'ambiance-boost', icon: '🌀', label: 'Ambiance Boost', description: 'Turn up live widget activity for a more dynamic desktop.' },
]

export const COMMON_EVENT_ACTION_KINDS: EventAction['kind'][] = [
  'desktop-config',
  'widget-theme-overrides',
  'widget-layout',
  'widget-command',
  'ambiance-patch',
]

export const COMMON_EVENT_EFFECT_TYPES: EffectType[] = [
  'desktop-notification',
  'network-glitch',
  'floaties',
  'static-burst',
]

export function getEventActionLabel(kind: EventAction['kind']) {
  if (kind === 'desktop-config') return 'Desktop look'
  if (kind === 'widget-theme-overrides') return 'Widget mood'
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

export const LAUNCH_PIPELINE_EFFECT_TYPES: EffectType[] = [
  'static-burst', 'screen-shake', 'vignette-pulse', 'network-glitch',
  'death-overlay', 'victory-overlay', 'revive-overlay',
  'terminal-toast', 'notification-box', 'typewriter',
  'floaties', 'corruption-burst', 'image-overlay', 'video-overlay',
]

export const EVENT_EFFECT_TYPES: EffectType[] = [
  'desktop-notification',
  ...LAUNCH_PIPELINE_EFFECT_TYPES,
]

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
      cfg: {
        count: 18,
        duration: 4,
        speed: 1,
      },
      delay: 0,
    }
  }

  if (type === 'corruption-burst') {
    return {
      type,
      cfg: {
        intensity: 'medium',
        duration: 1.4,
      },
      delay: 0,
    }
  }

  if (type === 'network-glitch') {
    return {
      type,
      cfg: {
        message: '[ NETWORK INTERRUPTION ]',
        duration: 2,
      },
      delay: 0,
    }
  }

  if (type === 'vignette-pulse') {
    return {
      type,
      cfg: {
        color: '#ff3b3b',
        opacity: 0.85,
        duration: 1.8,
        text: '',
      },
      delay: 0,
    }
  }

  if (type === 'screen-shake') {
    return {
      type,
      cfg: {
        intensity: 'medium',
        duration: 0.8,
      },
      delay: 0,
    }
  }

  if (type === 'typewriter') {
    return {
      type,
      cfg: {
        text: 'EVENT EXECUTED',
        position: 'center',
        color: '#8df6ff',
        fontSize: 48,
        duration: 2.6,
      },
      delay: 0,
    }
  }

  if (type === 'static-burst') {
    return {
      type,
      cfg: {
        opacity: 0.9,
        duration: 0.9,
      },
      delay: 0,
    }
  }

  if (type === 'image-overlay') {
    return {
      type,
      cfg: {
        src: '',
        opacity: 1,
        duration: 3,
      },
      delay: 0,
    }
  }

  if (type === 'video-overlay') {
    return {
      type,
      cfg: {
        src: '',
        opacity: 1,
        duration: 0,
        loop: false,
      },
      delay: 0,
    }
  }

  if (type === 'death-overlay' || type === 'victory-overlay' || type === 'revive-overlay') {
    return {
      type,
      cfg: { speed: 1 },
      delay: 0,
    } as EffectConfig
  }

  return { type, cfg: {}, delay: 0 } as EffectConfig
}

export function normalizeEventEffectConfig(effect: EffectConfig): EffectConfig {
  const base = createEffectDraft(effect.type) as EffectConfig & { cfg?: Record<string, unknown> }
  const current = effect as EffectConfig & { cfg?: Record<string, unknown> }
  return {
    ...base,
    ...current,
    cfg: {
      ...(base.cfg ?? {}),
      ...(current.cfg ?? {}),
    },
    delay: current.delay ?? base.delay ?? 0,
  } as EffectConfig
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

  if (kind === 'widget-theme-overrides') {
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

  return {
    kind,
    timeoutSeconds: 30,
    patch: {
      enabled: true,
      intervalSeconds: 30,
      maxOpenWidgets: 2,
      openWhileOneOpenChance: 0.35,
    },
  }
}

export function createEventPreset(
  presetId: EventPresetId,
  options?: {
    widgetIds?: string[]
    layoutId?: string
  },
): EventDef {
  const base = createEventDef()
  const firstWidgetId = options?.widgetIds?.[0] ?? 'music'

  if (presetId === 'signal-burst') {
    return {
      ...base,
      label: 'Signal Burst',
      icon: '📡',
      desc: 'Broadcast interruption pulse with a runtime heads-up message.',
      effects: [
        { type: 'network-glitch', cfg: { message: '[ SIGNAL INTERRUPTION ]', duration: 2 }, delay: 0 },
        { type: 'desktop-notification', cfg: { title: 'Signal burst', body: 'Transmission noise washed across the desktop.', icon: '📡', durationMs: 3200 }, delay: 0.2 },
      ],
    }
  }

  if (presetId === 'theme-shift') {
    return {
      ...base,
      label: 'Theme Shift',
      icon: '🎨',
      desc: 'Push the whole desktop into a new live chrome mood.',
      actions: [{
        kind: 'desktop-config',
        patch: {
          theme: 'frutiger aero',
          iconAnimation: 'float',
          iconMotion: 1.2,
          widgetTheme: structuredClone(DEFAULT_WIDGET_THEME_PRESETS['aero nova']),
          screenSaver: {
            enabled: true,
            timeoutMinutes: 6,
            preset: 'starfield',
          },
        },
      }],
    }
  }

  if (presetId === 'widget-mood') {
    return {
      ...base,
      label: 'Widget Mood',
      icon: '🪟',
      desc: 'Restyle specific widgets for a temporary personality shift.',
      actions: [{
        kind: 'widget-theme-overrides',
        widgetIds: options?.widgetIds?.slice(0, 2) ?? [firstWidgetId],
        clearExisting: false,
        theme: structuredClone(DEFAULT_WIDGET_THEME_PRESETS['digital futurism']),
      }],
    }
  }

  if (presetId === 'layout-recall') {
    return {
      ...base,
      label: 'Layout Recall',
      icon: '🗂',
      desc: 'Snap the live desktop into a saved widget arrangement.',
      actions: [{
        kind: 'widget-layout',
        layoutId: options?.layoutId ?? '',
      }],
    }
  }

  if (presetId === 'ambiance-boost') {
    return {
      ...base,
      label: 'Ambiance Boost',
      icon: '🌀',
      desc: 'Increase live widget motion and open-window churn.',
      actions: [{
        kind: 'ambiance-patch',
        patch: {
          enabled: true,
          intervalSeconds: 18,
          maxOpenWidgets: 3,
          openWhileOneOpenChance: 0.65,
        },
      }],
      auto: {
        ...base.auto,
        enabled: true,
        mode: 'interval',
        intervalMin: 12,
        chance: 0.65,
        cooldownMin: 8,
        allowedStates: [STATE.DESKTOP],
      },
    }
  }

  return base
}
