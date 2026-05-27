import type { AppConfig } from '@ieom/shared'
import type { Database as DatabaseType } from 'better-sqlite3'
import { clone } from '../utils.js'

const DEFAULT_OBS_CONFIG: AppConfig['obs'] = {
  url: 'ws://localhost:4455',
  password: '',
}

export class ObsConfigRepository {
  constructor(private db: DatabaseType) {}

  find(): AppConfig['obs'] {
    const row = this.db.prepare('SELECT url, password FROM obs_config WHERE id = 1').get() as AppConfig['obs'] | undefined
    return row ?? clone(DEFAULT_OBS_CONFIG)
  }

  save(cfg: AppConfig['obs']): void {
    this.db.prepare(`
      INSERT INTO obs_config (id, url, password) VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        url = excluded.url,
        password = excluded.password
    `).run(1, cfg.url, cfg.password)
  }
}
