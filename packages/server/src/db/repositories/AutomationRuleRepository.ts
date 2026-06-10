import type Database from 'better-sqlite3'
import type { AutomationRule } from '@ieomlabs/shared'

type RuleRow = {
  id: string
  enabled: number
  condition_event: string
  condition_match_json: string | null
  action_kind: string
  action_params_json: string
}

function toRule(row: RuleRow): AutomationRule {
  return {
    id: row.id,
    enabled: row.enabled === 1,
    condition: {
      event: row.condition_event,
      match: row.condition_match_json ? JSON.parse(row.condition_match_json) as Record<string, unknown> : undefined,
    },
    action: {
      kind: row.action_kind as AutomationRule['action']['kind'],
      params: JSON.parse(row.action_params_json) as Record<string, unknown>,
    },
  }
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
    this.db.prepare(
      'INSERT INTO automation_rules (id, enabled, condition_event, condition_match_json, action_kind, action_params_json) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(
      rule.id,
      rule.enabled ? 1 : 0,
      rule.condition.event,
      rule.condition.match ? JSON.stringify(rule.condition.match) : null,
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
      condition: { ...existing.condition, ...(patch.condition ?? {}) },
      action:    { ...existing.action,    ...(patch.action    ?? {}) },
    }
    this.db.prepare(
      'UPDATE automation_rules SET enabled=?, condition_event=?, condition_match_json=?, action_kind=?, action_params_json=? WHERE id=?'
    ).run(
      next.enabled ? 1 : 0,
      next.condition.event,
      next.condition.match ? JSON.stringify(next.condition.match) : null,
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
