/**
 * PostgreSQL connection pool module.
 * Creates and manages a pg.Pool instance configured from environment variables.
 * Supports both DATABASE_URL and individual PG* variables.
 */

import pg from 'pg'

const { Pool } = pg

export type { Pool } from 'pg'

/**
 * Creates a PostgreSQL connection pool configured from environment variables.
 * Uses DATABASE_URL if available, otherwise falls back to individual PG* variables.
 * Pool max connections is set to 20.
 */
export function createPool(): pg.Pool {
  const config: pg.PoolConfig = process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.PGHOST,
        port: parseInt(process.env.PGPORT ?? '5432', 10),
        database: process.env.PGDATABASE,
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
      }

  return new Pool({ ...config, max: 20 })
}

/**
 * Verifies the pool can connect to PostgreSQL.
 * Logs and exits with non-zero code if the initial connection fails.
 */
export async function verifyPoolConnection(pool: pg.Pool): Promise<void> {
  try {
    const client = await pool.connect()
    client.release()
  } catch (error) {
    console.error('[db] Failed to connect to PostgreSQL:', error)
    process.exit(1)
  }
}

/**
 * Registers graceful shutdown handlers for the pool.
 * Closes all connections on SIGTERM and SIGINT signals.
 */
export function registerPoolShutdown(pool: pg.Pool): void {
  const shutdown = async (signal: string) => {
    console.log(`[db] Received ${signal}, closing connection pool...`)
    try {
      await pool.end()
      console.log('[db] Connection pool closed.')
    } catch (error) {
      console.error('[db] Error closing connection pool:', error)
    }
    process.exit(0)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}
