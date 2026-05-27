import type { SourcePreset } from '@ieom/shared'
import type { Database as DatabaseType } from 'better-sqlite3'
import { parseJson } from '../utils.js'

export class SourcePresetRepository {
  constructor(private db: DatabaseType) {}

  findAll(): SourcePreset[] {
    const rows = this.db.prepare('SELECT * FROM source_presets ORDER BY rowid').all() as Array<{
      id: string
      label: string
      plugin_type: string
      config_json: string
      default_position_json: string | null
    }>

    return rows.map((row) => ({
      id: row.id,
      label: row.label,
      pluginType: row.plugin_type,
      config: parseJson<SourcePreset['config']>(row.config_json) ?? {},
      defaultPosition: parseJson<SourcePreset['defaultPosition']>(row.default_position_json),
    }))
  }

  save(preset: SourcePreset): void {
    this.db.prepare(`
      INSERT INTO source_presets (id, label, plugin_type, config_json, default_position_json)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        label = excluded.label,
        plugin_type = excluded.plugin_type,
        config_json = excluded.config_json,
        default_position_json = excluded.default_position_json
    `).run(
      preset.id,
      preset.label,
      preset.pluginType,
      JSON.stringify(preset.config ?? {}),
      preset.defaultPosition ? JSON.stringify(preset.defaultPosition) : null,
    )
  }

  saveAll(presets: SourcePreset[]): void {
    this.db.transaction(() => {
      this.db.exec('DELETE FROM source_presets')
      for (const preset of presets) this.save(preset)
    })()
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM source_presets WHERE id = ?').run(id)
  }
}
