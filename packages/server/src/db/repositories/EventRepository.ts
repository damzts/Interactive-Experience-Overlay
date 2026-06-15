import type Database from 'better-sqlite3'
import type { EventConfig, AutoTrigger } from '@ieomlabs/shared'

function parseJson<T>(v: string | null | undefined, fallback: T): T {
  if (!v) return fallback; try { return JSON.parse(v) as T } catch { return fallback }
}

const DEFAULT_AUTO: AutoTrigger = { enabled: false, mode: 'interval', intervalMin: 0, idleMin: 0, chance: 1, cooldownMin: 0 }

export class EventRepository {
  constructor(private db: Database.Database) {}

  load(): EventConfig[] {
    const rows = this.db.prepare('SELECT * FROM media_effects').all() as Array<{
      id: string; label: string; icon: string; color: string;
      desc: string; effects_json: string; actions_json: string | null; auto_json: string;
    }>
    return rows.map((row) => ({
      id: row.id, label: row.label, icon: row.icon, color: row.color, desc: row.desc,
      effects: parseJson(row.effects_json, []),
      actions: parseJson(row.actions_json, undefined),
      auto: parseJson<AutoTrigger>(row.auto_json, DEFAULT_AUTO),
    }))
  }

  save(events: EventConfig[]): void {
    this.db.prepare('DELETE FROM media_effects').run()
    const insert = this.db.prepare(`
      INSERT INTO media_effects (id, label, icon, color, desc, effects_json, actions_json, auto_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const e of events) {
      insert.run(e.id, e.label, e.icon, e.color, e.desc,
        JSON.stringify(e.effects ?? []),
        e.actions ? JSON.stringify(e.actions) : null,
        JSON.stringify(e.auto ?? DEFAULT_AUTO))
    }
  }
}
