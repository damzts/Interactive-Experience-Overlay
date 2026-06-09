import type Database from 'better-sqlite3'
import type { ReactiveChain } from '@ieomlabs/shared'

type ChainRow = {
  id: string
  trigger_widget_id: string
  trigger_event: string
  target_widget_id: string
  target_action: string
  enabled: number
}

export class ReactiveChainRepository {
  constructor(private db: Database.Database) {}

  list(): ReactiveChain[] {
    return (this.db.prepare('SELECT * FROM reactive_chains').all() as ChainRow[]).map(toChain)
  }

  get(id: string): ReactiveChain | undefined {
    const row = this.db.prepare('SELECT * FROM reactive_chains WHERE id = ?').get(id) as ChainRow | undefined
    return row ? toChain(row) : undefined
  }

  create(chain: ReactiveChain): ReactiveChain {
    this.db.prepare(
      'INSERT INTO reactive_chains (id, trigger_widget_id, trigger_event, target_widget_id, target_action, enabled) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(chain.id, chain.triggerWidgetId, chain.triggerEvent, chain.targetWidgetId, chain.targetAction, chain.enabled ? 1 : 0)
    return chain
  }

  update(id: string, patch: Partial<Pick<ReactiveChain, 'enabled' | 'targetAction' | 'triggerEvent' | 'triggerWidgetId' | 'targetWidgetId'>>): ReactiveChain | undefined {
    const existing = this.get(id)
    if (!existing) return undefined
    const next: ReactiveChain = { ...existing, ...patch }
    this.db.prepare(
      'UPDATE reactive_chains SET trigger_widget_id=?, trigger_event=?, target_widget_id=?, target_action=?, enabled=? WHERE id=?'
    ).run(next.triggerWidgetId, next.triggerEvent, next.targetWidgetId, next.targetAction, next.enabled ? 1 : 0, id)
    return next
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM reactive_chains WHERE id = ?').run(id)
    return result.changes > 0
  }
}

function toChain(row: ChainRow): ReactiveChain {
  return {
    id: row.id,
    triggerWidgetId: row.trigger_widget_id,
    triggerEvent: row.trigger_event,
    targetWidgetId: row.target_widget_id,
    targetAction: row.target_action,
    enabled: row.enabled === 1,
  }
}
