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
  CatalogActionKind,
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

/** Category → kinds for the hand-coded (non-catalog) kinds — real categories,
 *  not a catch-all "Common" bucket. */
const LEGACY_ACTION_CATEGORIES: { label: string; kinds: EventAction['kind'][] }[] = [
  { label: 'Desktop', kinds: ['desktop-config'] },
  { label: 'Widgets', kinds: ['widget-themes'] },
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
  return 'Widget mood'
}

export function describeEventSetup(def: EventDraft) {
  if (def.presetType === 'effect') return `Effect preset · ${def.effects.length} fx`
  if (def.presetType === 'action') return `Action preset · ${def.actions?.length ?? 0} action${def.actions?.length === 1 ? '' : 's'}`
  // Legacy (pre-split) preset — may mix both.
  if (def.actions?.length && def.effects.length) return 'Legacy · Automation + overlay FX'
  if (def.actions?.length) return 'Legacy · Runtime automation only'
  if (def.effects.length) return 'Legacy · Overlay FX only'
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

function createEventDef(presetType: 'effect' | 'action'): EventDef {
  return {
    id: 'custom-' + Date.now(),
    label: presetType === 'effect' ? 'New Effect' : 'New Action',
    icon: presetType === 'effect' ? '✨' : '⚡',
    color: 'text-cyan-400',
    desc: '',
    presetType,
    effects: [],
    actions: [],
    auto: { enabled: false, mode: 'interval', intervalMin: 15, idleMin: 5, chance: 1, cooldownMin: 0 },
  }
}

/** Creates a blank preset draft of the given kind. An "effect" preset
 *  edits only effects[] (overlay visuals); an "action" preset edits only
 *  actions[] (runtime automation) — see EventForm, which gates which
 *  section renders off `presetType`. */
export function createBlankEventDef(presetType: 'effect' | 'action'): EventDef {
  return createEventDef(presetType)
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

  return {
    kind: 'widget-themes' as const,
    timeoutSeconds: 30,
    widgetIds: [],
    clearExisting: false,
    theme: structuredClone(DEFAULT_WIDGET_THEME_PRESETS.metalheart),
  }
}

/** Lifts a pre-catalog persisted action of a migrated kind (widget-layout,
 *  widget-command, ambiance-patch — config stored flat on the action, with
 *  ambiance-patch nesting it under `patch`) onto the { kind, cfg } shape the
 *  generated editor renders. Already-cfg-shaped and legacy kinds pass
 *  through untouched. Mirrors normalizeEventAction in shared defaults.ts. */
export function normalizeDraftEventAction(action: DraftEventAction): DraftEventAction {
  if (isBlankAction(action) || !isCatalogActionKind(action.kind) || 'cfg' in action) return action
  const raw = action as unknown as Record<string, unknown> & { kind: CatalogActionKind; patch?: Record<string, unknown> }
  const { kind, patch, ...flat } = raw
  return { kind, cfg: { ...structuredClone(ACTION_CATALOG[kind].defaults), ...(patch ?? {}), ...flat } } as DraftEventAction
}
