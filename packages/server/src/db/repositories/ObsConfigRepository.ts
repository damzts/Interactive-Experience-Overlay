import type { AppConfig } from '@ieom/shared'
import type { Pool } from 'pg'

function clone<T>(value: T): T {
  return structuredClone(value)
}

const DEFAULT_OBS_CONFIG: AppConfig['obs'] = {
  url: 'ws://localhost:4455',
  password: '',
}

interface ObsConfigRow {
  user_id: string
  url: string
  password: string
}

export class ObsConfigRepository {
  constructor(private pool: Pool) {}

  async find(userId: string): Promise<AppConfig['obs']> {
    const { rows } = await this.pool.query<ObsConfigRow>(
      'SELECT url, password FROM obs_config WHERE user_id = $1',
      [userId]
    )
    if (rows.length === 0) return clone(DEFAULT_OBS_CONFIG)
    return { url: rows[0].url, password: rows[0].password }
  }

  async save(userId: string, cfg: AppConfig['obs']): Promise<void> {
    await this.pool.query(
      `INSERT INTO obs_config (user_id, url, password) VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET
         url = EXCLUDED.url,
         password = EXCLUDED.password`,
      [userId, cfg.url, cfg.password]
    )
  }
}
