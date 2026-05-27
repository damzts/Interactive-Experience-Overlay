import type { EventConfig } from '@ieom/shared'
import type { Database as DatabaseType } from 'better-sqlite3'
import { clone, parseJson } from '../utils.js'

const DEFAULT_EVENT_AUTO: EventConfig['auto'] = {
  enabled: false,
  mode: 'interval',
  intervalMin: 60,
  idleMin: 5,
  chance: 1,
  cooldownMin: 0,
}

export class EventRepository {
  constructor(private db: DatabaseType) {}

  findAll(): EventConfig[] {
    const rows = this.db.prepare('SELECT * FROM events ORDER BY rowid').all() as Array<{
      id: string
      label: string
      icon: string
      color: string
      desc: string
      effects_json: string
      actions_json: string | null
      auto_json: string
    }>

    return rows.map((row) => ({
      id: row.id,
      label: row.label,
      icon: row.icon,
      color: row.color,
      desc: row.desc,
      effects: parseJson<EventConfig['effects']>(row.effects_json) ?? [],
      actions: parseJson<EventConfig['actions']>(row.actions_json),
      auto: parseJson<EventConfig['auto']>(row.auto_json) ?? clone(DEFAULT_EVENT_AUTO),
    }))
  }

  save(event: EventConfig): void {
    this.db.prepare(`
      INSERT INTO events (
        id, label, icon, color, desc, effects_json, actions_json, auto_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        label = excluded.label,
        icon = excluded.icon,
        color = excluded.color,
        desc = excluded.desc,
        effects_json = excluded.effects_json,
        actions_json = excluded.actions_json,
        auto_json = excluded.auto_json
    `).run(
      event.id,
      event.label,
      event.icon,
      event.color,
      event.desc,
      JSON.stringify(event.effects ?? []),
      event.actions ? JSON.stringify(event.actions) : null,
      JSON.stringify(event.auto),
    )
  }

  saveAll(events: EventConfig[]): void {
    this.db.transaction(() => {
      this.db.exec('DELETE FROM events')
      for (const event of events) this.save(event)
    })()
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM events WHERE id = ?').run(id)
  }
}
