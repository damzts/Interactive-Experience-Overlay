import type Database from 'better-sqlite3'
import type { WidgetWire } from '@ieomlabs/shared'

type WireRow = {
  id: string
  trigger_widget_id: string
  trigger_event: string
  target_widget_id: string
  target_action: string
  enabled: number
}

export class WidgetWireRepository {
  constructor(private db: Database.Database) {}

  list(): WidgetWire[] {
    return (this.db.prepare('SELECT * FROM widget_wires').all() as WireRow[]).map(toWire)
  }

  get(id: string): WidgetWire | undefined {
    const row = this.db.prepare('SELECT * FROM widget_wires WHERE id = ?').get(id) as WireRow | undefined
    return row ? toWire(row) : undefined
  }

  create(wire: WidgetWire): WidgetWire {
    this.db.prepare(
      'INSERT INTO widget_wires (id, trigger_widget_id, trigger_event, target_widget_id, target_action, enabled) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(wire.id, wire.triggerWidgetId, wire.triggerEvent, wire.targetWidgetId, wire.targetAction, wire.enabled ? 1 : 0)
    return wire
  }

  update(id: string, patch: Partial<Pick<WidgetWire, 'enabled' | 'targetAction' | 'triggerEvent' | 'triggerWidgetId' | 'targetWidgetId'>>): WidgetWire | undefined {
    const existing = this.get(id)
    if (!existing) return undefined
    const next: WidgetWire = { ...existing, ...patch }
    this.db.prepare(
      'UPDATE widget_wires SET trigger_widget_id=?, trigger_event=?, target_widget_id=?, target_action=?, enabled=? WHERE id=?'
    ).run(next.triggerWidgetId, next.triggerEvent, next.targetWidgetId, next.targetAction, next.enabled ? 1 : 0, id)
    return next
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM widget_wires WHERE id = ?').run(id)
    return result.changes > 0
  }
}

function toWire(row: WireRow): WidgetWire {
  return {
    id: row.id,
    triggerWidgetId: row.trigger_widget_id,
    triggerEvent: row.trigger_event,
    targetWidgetId: row.target_widget_id,
    targetAction: row.target_action,
    enabled: row.enabled === 1,
  }
}
