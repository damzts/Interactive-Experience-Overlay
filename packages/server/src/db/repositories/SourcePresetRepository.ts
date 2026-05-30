import type { SourcePreset } from '@ieom/shared'
import type { Pool } from 'pg'

interface SourcePresetRow {
  id: string
  user_id: string
  label: string
  plugin_type: string
  config_json: unknown
  default_position_json: unknown | null
}

function rowToPreset(row: SourcePresetRow): SourcePreset {
  return {
    id: row.id,
    label: row.label,
    pluginType: row.plugin_type,
    config: (row.config_json as SourcePreset['config']) ?? {},
    defaultPosition: (row.default_position_json as SourcePreset['defaultPosition']) ?? undefined,
  }
}

export class SourcePresetRepository {
  constructor(private pool: Pool) {}

  async findAll(userId: string): Promise<SourcePreset[]> {
    const { rows } = await this.pool.query<SourcePresetRow>(
      'SELECT * FROM source_presets WHERE user_id = $1 ORDER BY id',
      [userId]
    )
    return rows.map(rowToPreset)
  }

  async save(userId: string, preset: SourcePreset): Promise<void> {
    await this.pool.query(
      `INSERT INTO source_presets (id, user_id, label, plugin_type, config_json, default_position_json)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, id) DO UPDATE SET
         label = EXCLUDED.label,
         plugin_type = EXCLUDED.plugin_type,
         config_json = EXCLUDED.config_json,
         default_position_json = EXCLUDED.default_position_json`,
      [
        preset.id,
        userId,
        preset.label,
        preset.pluginType,
        JSON.stringify(preset.config ?? {}),
        preset.defaultPosition ? JSON.stringify(preset.defaultPosition) : null,
      ]
    )
  }

  async saveAll(userId: string, presets: SourcePreset[]): Promise<void> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('DELETE FROM source_presets WHERE user_id = $1', [userId])
      for (const preset of presets) {
        await client.query(
          `INSERT INTO source_presets (id, user_id, label, plugin_type, config_json, default_position_json)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            preset.id,
            userId,
            preset.label,
            preset.pluginType,
            JSON.stringify(preset.config ?? {}),
            preset.defaultPosition ? JSON.stringify(preset.defaultPosition) : null,
          ]
        )
      }
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  }

  async delete(userId: string, id: string): Promise<void> {
    await this.pool.query(
      'DELETE FROM source_presets WHERE user_id = $1 AND id = $2',
      [userId, id]
    )
  }
}
