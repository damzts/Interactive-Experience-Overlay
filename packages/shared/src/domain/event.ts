import type { EffectConfig } from '../contracts/effects.js'
import type { STATE } from '../contracts/state.js'
import type { EventWidgetThemePatch } from './application.js'
import type { DesktopIconAnimation, EventDesktopTheme, DesktopConfig } from './desktop.js'
import type { AmbianceWidgetSimulationConfig } from './ambiance.js'
import type { ActionConfigMap, CatalogActionKind } from './actionCatalog.js'

// ── Auto-trigger configuration ───────────────────────────────────

/** Auto-trigger configuration for an event */
export interface AutoTrigger {
  enabled: boolean
  mode: 'interval' | 'idle'
  /** Fire roughly every N minutes (mode: interval) */
  intervalMin: number
  /** Fire after N minutes of idle (mode: idle) */
  idleMin: number
  /** 0-1 chance applied when the event becomes eligible. */
  chance: number
  /** Minimum delay before the same event can fire again. */
  cooldownMin: number
  /** Optional scene whitelist. Empty = any state. */
  allowedStates?: STATE[]
}

// ── Event actions ─────────────────────────────────────────────────

export interface EventDesktopConfigAction {
  kind: 'desktop-config'
  timeoutSeconds?: number
  /** When true, the patch is never auto-reverted (no scheduleRuntimeConfigReset).
   *  Used by ThemeDriftManager so ambient drift sticks as the new baseline
   *  until the next drift or an explicit runtime-config reset. */
  persistent?: boolean
  patch: {
    theme?: EventDesktopTheme
    iconAnimation?: DesktopIconAnimation
    iconMotion?: number
    iconArrangement?: DesktopConfig['iconArrangement']
    iconArrangementMotion?: number
    widgetTheme?: EventWidgetThemePatch
  }
}

export interface EventWidgetThemesAction {
  kind: 'widget-themes'
  timeoutSeconds?: number
  widgetIds: string[]
  clearExisting?: boolean
  theme: EventWidgetThemePatch
}

export interface EventWidgetLayoutAction {
  kind: 'widget-layout'
  layoutId: string
  timeoutSeconds?: number
}

export interface EventWidgetCommandAction {
  kind: 'widget-command'
  widgetId: string
  /** 'open'/'close'/'toggle' mutate authoritative state server-side (see
   *  scene.ts). Any other value is a custom widget/renderer action handled
   *  locally by the overlay's DOM-bus evaluator (widgetRuleEvaluator.ts) —
   *  the server leaves it alone. */
  action: 'open' | 'close' | 'toggle' | (string & {})
}

export interface EventAmbiancePatchAction {
  kind: 'ambiance-patch'
  timeoutSeconds?: number
  patch: Partial<AmbianceWidgetSimulationConfig>
}

/** A catalog-driven action (see actionCatalog.ts) — config schema, defaults,
 *  and admin editor are all generated from one ACTION_CATALOG entry instead
 *  of a bespoke interface + editor block per kind. */
export type EventCatalogAction = {
  [K in CatalogActionKind]: { kind: K; cfg: ActionConfigMap[K] }
}[CatalogActionKind]

export type EventAction =
  | EventDesktopConfigAction
  | EventWidgetThemesAction
  | EventWidgetLayoutAction
  | EventWidgetCommandAction
  | EventAmbiancePatchAction
  | EventCatalogAction

// ── Event entity ─────────────────────────────────────────────────

/** A saved event definition — persisted in AppConfig.sourceEvents */
export interface EventConfig {
  id: string
  label: string
  icon: string
  /** Tailwind text color class, e.g. 'text-red-400' */
  color: string
  desc: string
  /** Ordered stack of effects to fire. Empty = no visual. */
  effects: EffectConfig[]
  /** Runtime actions executed alongside overlay effects. */
  actions?: EventAction[]
  auto: AutoTrigger
}
