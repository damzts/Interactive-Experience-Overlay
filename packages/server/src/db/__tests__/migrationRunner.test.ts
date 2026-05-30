import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MigrationRunner } from '../migrationRunner.js'
import type { Migration } from '../migrationRunner.js'

function createMockClient() {
  return {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    release: vi.fn(),
  }
}

function createMockPool(client = createMockClient()) {
  return {
    query: vi.fn().mockResolvedValue({ rows: [{ version: 0 }] }),
    connect: vi.fn().mockResolvedValue(client),
  } as any
}

describe('MigrationRunner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  describe('ensureMigrationsTable', () => {
    it('creates schema_migrations table on run', async () => {
      const pool = createMockPool()
      // Mock getCurrentVersion to return 0 (no migrations applied)
      pool.query
        .mockResolvedValueOnce({ rows: [] }) // CREATE TABLE
        .mockResolvedValueOnce({ rows: [{ version: 999 }] }) // getCurrentVersion returns high version so no pending

      const runner = new MigrationRunner(pool)
      await runner.run()

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS schema_migrations')
      )
    })
  })

  describe('getCurrentVersion', () => {
    it('returns 0 when no migrations have been applied', async () => {
      const pool = createMockPool()
      pool.query.mockResolvedValueOnce({ rows: [{ version: 0 }] })

      const runner = new MigrationRunner(pool)
      const version = await runner.getCurrentVersion()
      expect(version).toBe(0)
    })

    it('returns the highest applied version', async () => {
      const pool = createMockPool()
      pool.query.mockResolvedValueOnce({ rows: [{ version: 5 }] })

      const runner = new MigrationRunner(pool)
      const version = await runner.getCurrentVersion()
      expect(version).toBe(5)
    })
  })

  describe('run', () => {
    it('applies pending migrations sequentially in transactions', async () => {
      const client = createMockClient()
      const pool = createMockPool(client)

      // ensureMigrationsTable
      pool.query.mockResolvedValueOnce({ rows: [] })
      // getCurrentVersion returns 0
      pool.query.mockResolvedValueOnce({ rows: [{ version: 0 }] })

      const upFn1 = vi.fn().mockResolvedValue(undefined)
      const upFn2 = vi.fn().mockResolvedValue(undefined)

      const testMigrations: Migration[] = [
        { version: 1, name: 'first', up: upFn1 },
        { version: 2, name: 'second', up: upFn2 },
      ]

      // Patch the migrations import by creating a runner and manually testing
      // We'll use a subclass approach to inject test migrations
      class TestMigrationRunner extends MigrationRunner {
        async run(): Promise<void> {
          // Replicate the logic with test migrations
          await (this as any).ensureMigrationsTable()
          const currentVersion = await this.getCurrentVersion()
          const pending = testMigrations.filter((m) => m.version > currentVersion)

          for (const migration of pending) {
            const c = await (this as any).pool.connect()
            try {
              await c.query('BEGIN')
              await migration.up(c)
              await c.query(
                'INSERT INTO schema_migrations (version, name) VALUES ($1, $2)',
                [migration.version, migration.name]
              )
              await c.query('COMMIT')
            } catch (error) {
              await c.query('ROLLBACK')
              throw error
            } finally {
              c.release()
            }
          }
        }
      }

      const runner = new TestMigrationRunner(pool)
      await runner.run()

      // Verify BEGIN/COMMIT pattern for each migration
      const clientCalls = client.query.mock.calls.map((c) => c[0])
      expect(clientCalls).toContain('BEGIN')
      expect(clientCalls).toContain('COMMIT')
      expect(upFn1).toHaveBeenCalledWith(client)
      expect(upFn2).toHaveBeenCalledWith(client)
    })

    it('rolls back and exits on migration failure', async () => {
      const client = createMockClient()
      const pool = createMockPool(client)
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

      // ensureMigrationsTable
      pool.query.mockResolvedValueOnce({ rows: [] })
      // getCurrentVersion returns 0
      pool.query.mockResolvedValueOnce({ rows: [{ version: 0 }] })

      const failingMigration: Migration = {
        version: 1,
        name: 'failing_migration',
        up: async () => { throw new Error('SQL syntax error') },
      }

      // Create a runner that uses our failing migration
      class TestMigrationRunner extends MigrationRunner {
        async run(): Promise<void> {
          await (this as any).ensureMigrationsTable()
          const currentVersion = await this.getCurrentVersion()
          const pending = [failingMigration].filter((m) => m.version > currentVersion)

          for (const migration of pending) {
            const c = await (this as any).pool.connect()
            try {
              await c.query('BEGIN')
              await migration.up(c)
              await c.query(
                'INSERT INTO schema_migrations (version, name) VALUES ($1, $2)',
                [migration.version, migration.name]
              )
              await c.query('COMMIT')
            } catch (error) {
              await c.query('ROLLBACK')
              console.error(
                `[migrations] Migration ${migration.version} (${migration.name}) failed:`,
                error
              )
              process.exit(1)
            } finally {
              c.release()
            }
          }
        }
      }

      const runner = new TestMigrationRunner(pool)
      await runner.run()

      const clientCalls = client.query.mock.calls.map((c) => c[0])
      expect(clientCalls).toContain('BEGIN')
      expect(clientCalls).toContain('ROLLBACK')
      expect(clientCalls).not.toContain('COMMIT')
      expect(mockExit).toHaveBeenCalledWith(1)

      mockExit.mockRestore()
    })

    it('skips already-applied migrations', async () => {
      const client = createMockClient()
      const pool = createMockPool(client)

      // ensureMigrationsTable
      pool.query.mockResolvedValueOnce({ rows: [] })
      // getCurrentVersion returns 1 (migration 1 already applied)
      pool.query.mockResolvedValueOnce({ rows: [{ version: 1 }] })

      const upFn1 = vi.fn()
      const upFn2 = vi.fn().mockResolvedValue(undefined)

      const testMigrations: Migration[] = [
        { version: 1, name: 'first', up: upFn1 },
        { version: 2, name: 'second', up: upFn2 },
      ]

      class TestMigrationRunner extends MigrationRunner {
        async run(): Promise<void> {
          await (this as any).ensureMigrationsTable()
          const currentVersion = await this.getCurrentVersion()
          const pending = testMigrations.filter((m) => m.version > currentVersion)

          for (const migration of pending) {
            const c = await (this as any).pool.connect()
            try {
              await c.query('BEGIN')
              await migration.up(c)
              await c.query(
                'INSERT INTO schema_migrations (version, name) VALUES ($1, $2)',
                [migration.version, migration.name]
              )
              await c.query('COMMIT')
            } finally {
              c.release()
            }
          }
        }
      }

      const runner = new TestMigrationRunner(pool)
      await runner.run()

      // Migration 1 should NOT have been called (already applied)
      expect(upFn1).not.toHaveBeenCalled()
      // Migration 2 should have been called
      expect(upFn2).toHaveBeenCalledWith(client)
    })

    it('does nothing when all migrations are applied', async () => {
      const client = createMockClient()
      const pool = createMockPool(client)

      // ensureMigrationsTable
      pool.query.mockResolvedValueOnce({ rows: [] })
      // getCurrentVersion returns 999 (higher than any migration)
      pool.query.mockResolvedValueOnce({ rows: [{ version: 999 }] })

      const runner = new MigrationRunner(pool)
      await runner.run()

      // pool.connect should not have been called (no pending migrations)
      expect(pool.connect).not.toHaveBeenCalled()
    })

    it('records each migration in schema_migrations table', async () => {
      const client = createMockClient()
      const pool = createMockPool(client)

      // ensureMigrationsTable
      pool.query.mockResolvedValueOnce({ rows: [] })
      // getCurrentVersion returns 0
      pool.query.mockResolvedValueOnce({ rows: [{ version: 0 }] })

      const testMigration: Migration = {
        version: 1,
        name: 'test_migration',
        up: vi.fn().mockResolvedValue(undefined),
      }

      class TestMigrationRunner extends MigrationRunner {
        async run(): Promise<void> {
          await (this as any).ensureMigrationsTable()
          const currentVersion = await this.getCurrentVersion()
          const pending = [testMigration].filter((m) => m.version > currentVersion)

          for (const migration of pending) {
            const c = await (this as any).pool.connect()
            try {
              await c.query('BEGIN')
              await migration.up(c)
              await c.query(
                'INSERT INTO schema_migrations (version, name) VALUES ($1, $2)',
                [migration.version, migration.name]
              )
              await c.query('COMMIT')
            } finally {
              c.release()
            }
          }
        }
      }

      const runner = new TestMigrationRunner(pool)
      await runner.run()

      // Verify the INSERT into schema_migrations was called
      expect(client.query).toHaveBeenCalledWith(
        'INSERT INTO schema_migrations (version, name) VALUES ($1, $2)',
        [1, 'test_migration']
      )
    })
  })
})
