import {
  DEFAULT_WIDGET_THEME_PRESETS,
  EFFECT_CATALOG,
  getEffectCategories,
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

/** Category → effect types, derived from the shared EFFECT_CATALOG.
 *  Adding an effect to the catalog makes it appear here automatically. */
export const EFFECT_CATEGORIES: { label: string; effects: EffectType[] }[] = getEffectCategories()

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

export function normalizeDesktopNotificationEffectConfig(
  cfg?: Partial<DesktopNotificationEffectConfig> | null,
): DesktopNotificationEffectConfig {
  return {
    ...EFFECT_CATALOG['desktop-notification'].defaults,
    ...cfg,
  }
}

/** Draft config for a new effect instance — defaults come from the shared catalog. */
export function createEffectDraft(type: EffectType): EffectConfig {
  return { type, cfg: structuredClone(EFFECT_CATALOG[type].defaults), delay: 0 } as EffectConfig
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
