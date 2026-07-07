import type Database from 'better-sqlite3'
import type { AppConfig, ConfigPreset } from '@ieomlabs/shared'

function parseJson<T>(v: string | null | undefined, fallback: T): T {
  if (!v) return fallback; try { return JSON.parse(v) as T } catch { return fallback }
}

export class ConfigPresetRepository {
  constructor(private db: Database.Database) {}

  list(): ConfigPreset[] {
    const rows = this.db.prepare('SELECT * FROM config_presets ORDER BY created_at DESC').all() as Array<{
      id: string; label: string; sections_json: string; created_at: number
    }>
    return rows.map((row) => ({
      id: row.id, label: row.label,
      sections: parseJson<Partial<AppConfig>>(row.sections_json, {}),
      createdAt: row.created_at,
    }))
  }

  get(id: string): ConfigPreset | undefined {
    const row = this.db.prepare('SELECT * FROM config_presets WHERE id = ?').get(id) as {
      id: string; label: string; sections_json: string; created_at: number
    } | undefined
    if (!row) return undefined
    return {
      id: row.id, label: row.label,
      sections: parseJson<Partial<AppConfig>>(row.sections_json, {}),
      createdAt: row.created_at,
    }
  }

  upsert(preset: ConfigPreset): void {
    this.db.prepare(`
      INSERT INTO config_presets (id, label, sections_json, created_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET label = excluded.label, sections_json = excluded.sections_json
    `).run(preset.id, preset.label, JSON.stringify(preset.sections), preset.createdAt)
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM config_presets WHERE id = ?').run(id)
  }
}
