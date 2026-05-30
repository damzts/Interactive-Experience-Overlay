import type { AppConfig } from '@ieom/shared'
import type { Pool } from 'pg'

function clone<T>(value: T): T {
  return structuredClone(value)
}

const DEFAULT_AUDIO_CONFIG: AppConfig['audio'] = {
  masterVolume: 0.8,
  sfxVolume: 0.7,
  musicVolume: 0.4,
}

interface AudioConfigRow {
  user_id: string
  master_volume: number
  sfx_volume: number
  music_volume: number
}

export class AudioConfigRepository {
  constructor(private pool: Pool) {}

  async find(userId: string): Promise<AppConfig['audio']> {
    const { rows } = await this.pool.query<AudioConfigRow>(
      'SELECT master_volume, sfx_volume, music_volume FROM audio_config WHERE user_id = $1',
      [userId]
    )
    if (rows.length === 0) return clone(DEFAULT_AUDIO_CONFIG)
    return {
      masterVolume: rows[0].master_volume,
      sfxVolume: rows[0].sfx_volume,
      musicVolume: rows[0].music_volume,
    }
  }

  async save(userId: string, cfg: AppConfig['audio']): Promise<void> {
    await this.pool.query(
      `INSERT INTO audio_config (user_id, master_volume, sfx_volume, music_volume) VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE SET
         master_volume = EXCLUDED.master_volume,
         sfx_volume = EXCLUDED.sfx_volume,
         music_volume = EXCLUDED.music_volume`,
      [userId, cfg.masterVolume, cfg.sfxVolume, cfg.musicVolume]
    )
  }
}
