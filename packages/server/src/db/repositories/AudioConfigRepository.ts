import type { AppConfig } from '@ieom/shared'
import type { Database as DatabaseType } from 'better-sqlite3'
import { clone } from '../utils.js'

const DEFAULT_AUDIO_CONFIG: AppConfig['audio'] = {
  masterVolume: 0.8,
  sfxVolume: 0.7,
  musicVolume: 0.4,
}

export class AudioConfigRepository {
  constructor(private db: DatabaseType) {}

  find(): AppConfig['audio'] {
    const row = this.db.prepare('SELECT master_volume, sfx_volume, music_volume FROM audio_config WHERE id = 1').get() as {
      master_volume: number
      sfx_volume: number
      music_volume: number
    } | undefined

    return row
      ? {
          masterVolume: row.master_volume,
          sfxVolume: row.sfx_volume,
          musicVolume: row.music_volume,
        }
      : clone(DEFAULT_AUDIO_CONFIG)
  }

  save(cfg: AppConfig['audio']): void {
    this.db.prepare(`
      INSERT INTO audio_config (id, master_volume, sfx_volume, music_volume) VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        master_volume = excluded.master_volume,
        sfx_volume = excluded.sfx_volume,
        music_volume = excluded.music_volume
    `).run(1, cfg.masterVolume, cfg.sfxVolume, cfg.musicVolume)
  }
}
