import {
  ACTION_CATALOG,
  DEFAULT_WIDGET_THEME_PRESETS,
  EFFECT_CATALOG,
  getActionCategories,
  getActionLabel,
  getEffectCategories,
  isCatalogActionKind,
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

/** A runtime action that hasn't had a kind picked yet — a blank row in the editor. */
export type DraftEventAction = EventAction | { kind: '' }

/** An effect that hasn't had a type picked yet — a blank row in the editor. */
export type DraftEffectConfig = EffectConfig | { type: '' }

/** What EventForm edits: same as EventDef, but actions/effects may contain blank
 *  (not-yet-typed) rows. A fully-populated EventDef is always a valid EventDraft. */
export type EventDraft = Omit<EventDef, 'actions' | 'effects'> & {
  actions?: DraftEventAction[]
  effects: DraftEffectConfig[]
}

export const DEFAULT_EVENT_DEFS: EventDef[] = []

export const COMMON_EVENT_ACTION_KINDS: EventAction['kind'][] = [
  'desktop-config',
  'widget-themes',
  'widget-layout',
  'widget-command',
  'ambiance-patch',
]

/** Category → kinds for the hand-coded (non-catalog) kinds — real categories,
 *  not a catch-all "Common" bucket. */
const LEGACY_ACTION_CATEGORIES: { label: string; kinds: EventAction['kind'][] }[] = [
  { label: 'Desktop', kinds: ['desktop-config'] },
  { label: 'Widgets', kinds: ['widget-themes', 'widget-layout', 'widget-command'] },
  { label: 'Ambiance', kinds: ['ambiance-patch'] },
]

/** Category → kinds for the per-row action type selector: the four
 *  hand-coded kinds under their real categories, plus every catalog action
 *  (see @ieomlabs/shared's ACTION_CATALOG) grouped by its own category —
 *  merged into the legacy group of the same name where one exists (e.g.
 *  "Ambiance" covers both `ambiance-patch` and `ambiance-clear-history`).
 *  Adding a catalog action makes it appear here automatically. */
export const ACTION_CATEGORIES: { label: string; kinds: EventAction['kind'][] }[] = (() => {
  const groups = LEGACY_ACTION_CATEGORIES.map((cat) => ({ label: cat.label, kinds: [...cat.kinds] }))
  for (const cat of getActionCategories()) {
    const existing = groups.find((g) => g.label === cat.label)
    if (existing) existing.kinds.push(...cat.kinds as EventAction['kind'][])
    else groups.push({ label: cat.label, kinds: cat.kinds as EventAction['kind'][] })
  }
  return groups
})()

/** Category → effect types, derived from the shared EFFECT_CATALOG.
 *  Adding an effect to the catalog makes it appear here automatically. */
export const EFFECT_CATEGORIES: { label: string; effects: EffectType[] }[] = getEffectCategories()

export const EVENT_EFFECT_TYPES: EffectType[] = EFFECT_CATEGORIES.flatMap(c => c.effects)

export function getEventActionLabel(kind: EventAction['kind']) {
  if (isCatalogActionKind(kind)) return getActionLabel(kind)
  if (kind === 'desktop-config') return 'Desktop look'
  if (kind === 'widget-themes') return 'Widget mood'
  if (kind === 'widget-layout') return 'Widget layout'
  if (kind === 'widget-command') return 'Widget state'
  return 'Ambiance'
}

export function describeEventSetup(def: EventDraft) {
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

/** Normalizes a draft effect row, leaving still-blank (no type chosen) rows untouched. */
export function normalizeDraftEffectConfig(effect: DraftEffectConfig): DraftEffectConfig {
  return effect.type ? normalizeEventEffectConfig(effect) : effect
}

export function isBlankAction(action: DraftEventAction): action is { kind: '' } {
  return action.kind === ''
}

export function isBlankEffect(effect: DraftEffectConfig): effect is { type: '' } {
  return effect.type === ''
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
  if (isCatalogActionKind(kind)) {
    return { kind, cfg: structuredClone(ACTION_CATALOG[kind].defaults) } as EventAction
  }

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
