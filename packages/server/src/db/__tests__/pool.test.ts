import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock pg module before importing pool
vi.mock('pg', () => {
  const mockClient = { release: vi.fn() }
  const mockPool = {
    connect: vi.fn().mockResolvedValue(mockClient),
    end: vi.fn().mockResolvedValue(undefined),
  }
  const Pool = vi.fn(() => mockPool)
  return { default: { Pool }, Pool }
})

import { createPool, verifyPoolConnection, registerPoolShutdown } from '../pool.js'
import pg from 'pg'

const { Pool: MockPool } = pg

describe('createPool', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    vi.clearAllMocks()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('creates pool with DATABASE_URL when available', () => {
    process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/ieom'

    createPool()

    expect(MockPool).toHaveBeenCalledWith({
      connectionString: 'postgres://user:pass@localhost:5432/ieom',
      max: 20,
    })
  })

  it('creates pool with individual PG* variables when DATABASE_URL is absent', () => {
    delete process.env.DATABASE_URL
    process.env.PGHOST = 'db.example.com'
    process.env.PGPORT = '5433'
    process.env.PGDATABASE = 'mydb'
    process.env.PGUSER = 'admin'
    process.env.PGPASSWORD = 'secret'

    createPool()

    expect(MockPool).toHaveBeenCalledWith({
      host: 'db.example.com',
      port: 5433,
      database: 'mydb',
      user: 'admin',
      password: 'secret',
      max: 20,
    })
  })

  it('defaults PGPORT to 5432 when not specified', () => {
    delete process.env.DATABASE_URL
    process.env.PGHOST = 'localhost'
    delete process.env.PGPORT
    process.env.PGDATABASE = 'ieom'
    process.env.PGUSER = 'user'
    process.env.PGPASSWORD = 'pass'

    createPool()

    expect(MockPool).toHaveBeenCalledWith(
      expect.objectContaining({ port: 5432 })
    )
  })

  it('sets max connections to 20', () => {
    process.env.DATABASE_URL = 'postgres://user:pass@localhost/ieom'

    createPool()

    expect(MockPool).toHaveBeenCalledWith(
      expect.objectContaining({ max: 20 })
    )
  })
})

describe('verifyPoolConnection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('succeeds when pool can connect', async () => {
    const mockClient = { release: vi.fn() }
    const pool = { connect: vi.fn().mockResolvedValue(mockClient) } as any

    await verifyPoolConnection(pool)

    expect(pool.connect).toHaveBeenCalled()
    expect(mockClient.release).toHaveBeenCalled()
  })

  it('exits with code 1 when connection fails', async () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    const mockError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const pool = { connect: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) } as any

    await verifyPoolConnection(pool)

    expect(mockError).toHaveBeenCalledWith(
      '[db] Failed to connect to PostgreSQL:',
      expect.any(Error)
    )
    expect(mockExit).toHaveBeenCalledWith(1)

    mockExit.mockRestore()
    mockError.mockRestore()
  })
})

describe('registerPoolShutdown', () => {
  it('registers SIGTERM and SIGINT handlers', () => {
    const onSpy = vi.spyOn(process, 'on')
    const pool = { end: vi.fn().mockResolvedValue(undefined) } as any

    registerPoolShutdown(pool)

    expect(onSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function))
    expect(onSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function))

    onSpy.mockRestore()
  })
})
