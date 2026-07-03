import type Database from 'better-sqlite3'
import type { AutomationRule, AutomationActionKind, AutomationTrigger } from '@ieomlabs/shared'

const VALID_ACTION_KINDS: AutomationActionKind[] = [
  'widget:action', 'widget:toggle', 'scene:change', 'overlay:show', 'desktop:notify', 'signal:emit',
]

type RuleRow = {
  id: string
  enabled: number
  trigger_source: string
  trigger_widget_id: string | null
  trigger_event: string
  trigger_match_json: string | null
  scene_is_json: string | null
  action_kind: string
  action_params_json: string
}

function toRule(row: RuleRow): AutomationRule {
  return {
    id: row.id,
    enabled: row.enabled === 1,
    trigger: {
      source: row.trigger_source === 'widget' ? 'widget' : 'kernel',
      event: row.trigger_event,
      widgetId: row.trigger_widget_id ?? undefined,
      match: row.trigger_match_json ? JSON.parse(row.trigger_match_json) as Record<string, unknown> : undefined,
      sceneIs: row.scene_is_json ? JSON.parse(row.scene_is_json) as AutomationTrigger['sceneIs'] : undefined,
    },
    action: {
      kind: row.action_kind as AutomationActionKind,
      params: JSON.parse(row.action_params_json) as Record<string, unknown>,
    },
  }
}

export function isValidActionKind(kind: string): kind is AutomationActionKind {
  return (VALID_ACTION_KINDS as string[]).includes(kind)
}

export class AutomationRuleRepository {
  constructor(private db: Database.Database) {}

  list(): AutomationRule[] {
    return (this.db.prepare('SELECT * FROM automation_rules').all() as RuleRow[]).map(toRule)
  }

  find(id: string): AutomationRule | undefined {
    const row = this.db.prepare('SELECT * FROM automation_rules WHERE id = ?').get(id) as RuleRow | undefined
    return row ? toRule(row) : undefined
  }

  create(rule: AutomationRule): AutomationRule {
    if (!isValidActionKind(rule.action.kind)) throw new Error(`invalid action kind: ${rule.action.kind}`)
    this.db.prepare(
      'INSERT INTO automation_rules (id, enabled, trigger_source, trigger_widget_id, trigger_event, trigger_match_json, scene_is_json, action_kind, action_params_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      rule.id,
      rule.enabled ? 1 : 0,
      rule.trigger.source,
      rule.trigger.widgetId ?? null,
      rule.trigger.event,
      rule.trigger.match ? JSON.stringify(rule.trigger.match) : null,
      rule.trigger.sceneIs ? JSON.stringify(rule.trigger.sceneIs) : null,
      rule.action.kind,
      JSON.stringify(rule.action.params),
    )
    return rule
  }

  update(id: string, patch: Partial<Omit<AutomationRule, 'id'>>): AutomationRule | undefined {
    const existing = this.find(id)
    if (!existing) return undefined
    const next: AutomationRule = {
      ...existing,
      ...patch,
      trigger: { ...existing.trigger, ...(patch.trigger ?? {}) },
      action:  { ...existing.action,  ...(patch.action  ?? {}) },
    }
    if (!isValidActionKind(next.action.kind)) throw new Error(`invalid action kind: ${next.action.kind}`)
    this.db.prepare(
      'UPDATE automation_rules SET enabled=?, trigger_source=?, trigger_widget_id=?, trigger_event=?, trigger_match_json=?, scene_is_json=?, action_kind=?, action_params_json=? WHERE id=?'
    ).run(
      next.enabled ? 1 : 0,
      next.trigger.source,
      next.trigger.widgetId ?? null,
      next.trigger.event,
      next.trigger.match ? JSON.stringify(next.trigger.match) : null,
      next.trigger.sceneIs ? JSON.stringify(next.trigger.sceneIs) : null,
      next.action.kind,
      JSON.stringify(next.action.params),
      id,
    )
    return next
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM automation_rules WHERE id = ?').run(id)
    return result.changes > 0
  }
}
