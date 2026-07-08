import type Database from 'better-sqlite3'
import type { Sequence, SequenceStep } from '@ieomlabs/shared'

function parseJson<T>(v: string | null | undefined, fallback: T): T {
  if (!v) return fallback; try { return JSON.parse(v) as T } catch { return fallback }
}

export class SequenceRepository {
  constructor(private db: Database.Database) {}

  list(): Sequence[] {
    const rows = this.db.prepare('SELECT * FROM sequences ORDER BY created_at DESC').all() as Array<{
      id: string; label: string; steps_json: string; created_at: number
    }>
    return rows.map((row) => ({
      id: row.id, label: row.label,
      steps: parseJson<SequenceStep[]>(row.steps_json, []),
    }))
  }

  get(id: string): Sequence | undefined {
    const row = this.db.prepare('SELECT * FROM sequences WHERE id = ?').get(id) as {
      id: string; label: string; steps_json: string; created_at: number
    } | undefined
    if (!row) return undefined
    return {
      id: row.id, label: row.label,
      steps: parseJson<SequenceStep[]>(row.steps_json, []),
    }
  }

  upsert(seq: Sequence, createdAt = Date.now()): void {
    this.db.prepare(`
      INSERT INTO sequences (id, label, steps_json, created_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET label = excluded.label, steps_json = excluded.steps_json
    `).run(seq.id, seq.label, JSON.stringify(seq.steps), createdAt)
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM sequences WHERE id = ?').run(id)
  }
}
