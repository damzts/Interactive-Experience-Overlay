/**
 * Automation rules — "when KernelEvent X fires → do Y".
 * Persisted in the automation_rules SQLite table.
 * No scripting, no loops, field-match conditions only.
 */

export type AutomationActionKind = 'widget:toggle' | 'scene:change' | 'overlay:show' | 'desktop:notify'

export interface AutomationRuleCondition {
  /** KernelEvent name to listen for, e.g. 'scene:changed' */
  event: string
  /**
   * Optional field-match filter on the event payload.
   * Rule fires only when all keys in match equal the corresponding payload fields.
   * Omit or leave empty to fire on every occurrence of the event.
   */
  match?: Record<string, unknown>
}

export interface AutomationRuleAction {
  kind: AutomationActionKind
  params: Record<string, unknown>
}

export interface AutomationRule {
  id: string
  enabled: boolean
  condition: AutomationRuleCondition
  action: AutomationRuleAction
}
