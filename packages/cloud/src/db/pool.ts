import pg from 'pg'

const { Pool } = pg

export type { Pool } from 'pg'

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

export async function verifyPoolConnection(pool: pg.Pool): Promise<void> {
  try {
    const client = await pool.connect()
    client.release()
  } catch (error) {
    console.error('[db] Failed to connect to PostgreSQL:', error)
    process.exit(1)
  }
}

export function registerPoolShutdown(pool: pg.Pool): void {
  const shutdown = async (signal: string) => {
    console.log(`[db] Received ${signal}, closing connection pool...`)
    try {
      await pool.end()
    } catch (error) {
      console.error('[db] Error closing connection pool:', error)
    }
    process.exit(0)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}
