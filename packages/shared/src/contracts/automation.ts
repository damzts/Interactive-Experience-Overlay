/**
 * Automation rules — the unified "any signal → any action" system.
 *
 * Absorbs the former WidgetWire model: one rule shape covers both
 * kernel-event triggers (evaluated in the server) and widget/renderer
 * signal triggers (widget:action executed synchronously in the overlay;
 * every other kind executed in the server).
 *
 * Persisted in the automation_rules SQLite table; legacy widget_wires
 * rows are imported on first boot. No scripting, no loops —
 * field-match conditions plus a single-hop signal:emit chain.
 */
import type { STATE } from './state.js'
import type { EventAction } from '../domain/event.js'

export type AutomationTriggerSource = 'kernel' | 'widget'

export interface AutomationTrigger {
  /** kernel = KernelBus event; widget = overlay DOM-bus signal (widgets and renderers) */
  source: AutomationTriggerSource
  /** Kernel event name (e.g. 'scene:changed') or widget signal event (e.g. 'quest:complete') */
  event: string
  /** source='widget' only: the emitting widget/renderer instance id. Empty/omitted = any source. */
  widgetId?: string
  /**
   * Optional field-match filter on the event payload.
   * Rule fires only when all keys in match equal the corresponding payload fields.
   * Omit or leave empty to fire on every occurrence of the event.
   */
  match?: Record<string, unknown>
  /** Rule only fires while the current visual state is in this list. Omit = any scene. */
  sceneIs?: STATE[]

  // ── Stateful conditions ─────────────────────────────────────────
  // Evaluated by createAutomationGate (constants/automationGate.ts).
  // State is RAM-only and lives in whichever evaluator executes the rule
  // (server AutomationManager, or the overlay for custom widget:action
  // rules) — the action-kind split guarantees a rule runs in one place.

  /** Minimum ms between firings of this rule. Omit/0 = no cooldown. */
  cooldownMs?: number
  /** Fire only on every Nth match (2 = every other match). Omit/1 = every match. */
  everyN?: number
  /** Fire when this many matches arrive within windowMs (rolling window;
   *  the window clears after firing). Omit/1 = no window condition. */
  windowCount?: number
  /** Window size for windowCount, in ms. Default 60000. */
  windowMs?: number
}

export interface AutomationRule {
  id: string
  enabled: boolean
  trigger: AutomationTrigger
  /** Same vocabulary Events use — see ACTION_CATALOG (domain/actionCatalog.ts)
   *  and the hand-coded EventAction kinds (domain/event.ts). Dispatched via
   *  the shared scheduler:fired/executeConfiguredEvent pipeline, so any
   *  action reachable from an Event is reachable from an Automation Rule. */
  action: EventAction
}

/** Marker key set on payloads produced by signal:emit actions (loop guard). */
export const SYNTHETIC_SIGNAL_KEY = '__synthetic'

export function isSyntheticSignalPayload(payload: unknown): boolean {
  return typeof payload === 'object' && payload !== null
    && (payload as Record<string, unknown>)[SYNTHETIC_SIGNAL_KEY] === true
}
