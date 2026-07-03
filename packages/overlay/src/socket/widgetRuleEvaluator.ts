import type { AutomationRule, STATE } from '@ieomlabs/shared'

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

    if (rule.action.kind !== 'widget:action') continue
    const targetWidgetId = rule.action.params['targetWidgetId']
    const action = rule.action.params['action']
    if (typeof targetWidgetId !== 'string' || typeof action !== 'string') continue
    if (AUTHORITATIVE_ACTIONS.has(action)) continue
    actions.push({ targetWidgetId, action })
  }
  return actions
}
