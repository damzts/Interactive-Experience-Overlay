import type { AutomationGate, AutomationRule, STATE } from '@ieomlabs/shared'

export interface WidgetSignalLike {
  source: string
  event: string
  payload?: unknown
}

export interface LocalWidgetAction {
  targetWidgetId: string
  action: string
}

/** Actions that mutate authoritative widget open state — executed by the server's
 *  AutomationManager, never locally. */
const AUTHORITATIVE_ACTIONS = new Set(['open', 'close', 'toggle'])

function matchesPayload(match: Record<string, unknown> | undefined, payload: unknown): boolean {
  if (!match || Object.keys(match).length === 0) return true
  if (typeof payload !== 'object' || payload === null) return false
  const p = payload as Record<string, unknown>
  return Object.entries(match).every(([k, v]) => p[k] === v)
}

/**
 * Match widget-source automation rules against a DOM-bus signal and return the
 * overlay-local widget actions to dispatch (synchronous, zero round-trip).
 * The same signal is also forwarded to the kernel, which executes every other
 * action kind — the kind split guarantees nothing runs twice.
 */
export function evaluateWidgetRules(
  rules: AutomationRule[],
  signal: WidgetSignalLike,
  currentState: STATE,
  /** Stateful firing gate (cooldown / everyN / window). Only consulted for
   *  rules this evaluator executes — server-executed rules are gated by the
   *  server's own gate instance. Omit for stateless evaluation. */
  gate?: AutomationGate,
): LocalWidgetAction[] {
  const actions: LocalWidgetAction[] = []
  for (const rule of rules) {
    if (!rule.enabled) continue
    const t = rule.trigger
    if (t.source !== 'widget') continue
    if (t.event !== signal.event) continue
    if (t.widgetId && t.widgetId !== signal.source) continue
    if (t.sceneIs?.length && !t.sceneIs.includes(currentState)) continue
    if (!matchesPayload(t.match, signal.payload)) continue

    if (rule.action.kind !== 'widget-command') continue
    // Rules saved before widget-command joined ACTION_CATALOG store the
    // config flat on the action instead of under cfg — read both shapes.
    const raw = rule.action as unknown as { cfg?: { widgetId?: string; action?: string }; widgetId?: string; action?: string }
    const targetWidgetId = raw.cfg?.widgetId ?? raw.widgetId
    const action = raw.cfg?.action ?? raw.action
    if (!targetWidgetId || !action) continue
    if (AUTHORITATIVE_ACTIONS.has(action)) continue
    if (gate && !gate(rule)) continue
    actions.push({ targetWidgetId, action })
  }
  return actions
}
