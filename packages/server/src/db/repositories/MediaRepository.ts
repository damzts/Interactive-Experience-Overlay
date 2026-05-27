import type { MediaEntry } from '@ieom/shared'
import type { Database as DatabaseType } from 'better-sqlite3'

export class MediaRepository {
  constructor(private db: DatabaseType) {}

  findAll(): MediaEntry[] {
    const rows = this.db.prepare('SELECT * FROM media_library ORDER BY rowid').all() as Array<{
      id: string
      name: string
      type: MediaEntry['type']
      url: string
      duration: number | null
    }>

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      url: row.url,
      duration: row.duration ?? undefined,
    }))
  }

  save(entry: MediaEntry): void {
    this.db.prepare(`
      INSERT INTO media_library (id, name, type, url, duration) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        type = excluded.type,
        url = excluded.url,
        duration = excluded.duration
    `).run(entry.id, entry.name, entry.type, entry.url, entry.duration ?? null)
  }

  saveAll(entries: MediaEntry[]): void {
    this.db.transaction(() => {
      this.db.exec('DELETE FROM media_library')
      for (const entry of entries) this.save(entry)
    })()
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM media_library WHERE id = ?').run(id)
  }
}
