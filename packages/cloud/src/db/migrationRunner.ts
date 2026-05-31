import type { Pool, PoolClient } from 'pg'
import { migrations } from './pgMigrations/index.js'

export interface Migration {
  version: number
  name: string
  up: (client: PoolClient) => Promise<void>
}

export class MigrationRunner {
  constructor(private pool: Pool) {}

  private async ensureMigrationsTable(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
  }

  async getCurrentVersion(): Promise<number> {
    const result = await this.pool.query<{ version: number }>(
      'SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations'
    )
    return result.rows[0].version
  }

  async run(): Promise<void> {
    await this.ensureMigrationsTable()
    const currentVersion = await this.getCurrentVersion()
    const pending = migrations.filter((m) => m.version > currentVersion)

    if (pending.length === 0) {
      console.log('[migrations] Database schema is up to date.')
      return
    }

    console.log(`[migrations] Current version: ${currentVersion}. Applying ${pending.length} pending migration(s)...`)

    for (const migration of pending) {
      const client = await this.pool.connect()
      try {
        await client.query('BEGIN')
        await migration.up(client)
        await client.query('INSERT INTO schema_migrations (version, name) VALUES ($1, $2)', [migration.version, migration.name])
        await client.query('COMMIT')
        console.log(`[migrations] Migration ${migration.version} applied.`)
      } catch (error) {
        await client.query('ROLLBACK')
        console.error(`[migrations] Migration ${migration.version} (${migration.name}) failed:`, error)
        process.exit(1)
      } finally {
        client.release()
      }
    }
  }
}
