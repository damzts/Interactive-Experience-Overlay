import type { AppConfig } from '@ieom/shared'
import type { Pool } from 'pg'

interface KeybindRow {
  user_id: string
  scope: string
  key: string
  action: string
}

export class KeybindRepository {
  constructor(private pool: Pool) {}

  async find(userId: string): Promise<AppConfig['keybinds']> {
    const { rows } = await this.pool.query<KeybindRow>(
      'SELECT scope, key, action FROM keybinds WHERE user_id = $1',
      [userId]
    )

    const keybinds: AppConfig['keybinds'] = { obs: {}, admin: {} }
    for (const row of rows) {
      if (row.scope === 'obs' || row.scope === 'admin') {
        keybinds[row.scope][row.key] = row.action
      }
    }
    return keybinds
  }

  async save(userId: string, keybinds: AppConfig['keybinds']): Promise<void> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('DELETE FROM keybinds WHERE user_id = $1', [userId])
      for (const [key, action] of Object.entries(keybinds.obs)) {
        await client.query(
          'INSERT INTO keybinds (user_id, scope, key, action) VALUES ($1, $2, $3, $4)',
          [userId, 'obs', key, action]
        )
      }
      for (const [key, action] of Object.entries(keybinds.admin)) {
        await client.query(
          'INSERT INTO keybinds (user_id, scope, key, action) VALUES ($1, $2, $3, $4)',
          [userId, 'admin', key, action]
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
}
