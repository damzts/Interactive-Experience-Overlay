import { describe, it, expect, vi } from 'vitest'
import { validateEnv } from '../envValidation.js'

describe('validateEnv', () => {
  const fullEnv = {
    PGHOST: 'localhost',
    PGDATABASE: 'ieom',
    PGUSER: 'user',
    PGPASSWORD: 'pass',
    GOOGLE_CLIENT_ID: 'client-id',
    GOOGLE_CLIENT_SECRET: 'client-secret',
    JWT_SECRET: 'jwt-secret',
  }

  it('returns valid when all required variables are present', () => {
    const result = validateEnv(fullEnv)
    expect(result.valid).toBe(true)
    expect(result.missing).toEqual([])
  })

  it('returns valid when DATABASE_URL is provided instead of PG* variables', () => {
    const env = {
      DATABASE_URL: 'postgres://user:pass@localhost/ieom',
      GOOGLE_CLIENT_ID: 'client-id',
      GOOGLE_CLIENT_SECRET: 'client-secret',
      JWT_SECRET: 'jwt-secret',
    }
    const result = validateEnv(env)
    expect(result.valid).toBe(true)
    expect(result.missing).toEqual([])
  })

  it('reports missing PG* variables when DATABASE_URL is absent', () => {
    const env = {
      GOOGLE_CLIENT_ID: 'client-id',
      GOOGLE_CLIENT_SECRET: 'client-secret',
      JWT_SECRET: 'jwt-secret',
    }
    const result = validateEnv(env)
    expect(result.valid).toBe(false)
    expect(result.missing).toContain('PGHOST')
    expect(result.missing).toContain('PGDATABASE')
    expect(result.missing).toContain('PGUSER')
    expect(result.missing).toContain('PGPASSWORD')
  })

  it('reports missing auth variables even when DATABASE_URL is present', () => {
    const env = {
      DATABASE_URL: 'postgres://user:pass@localhost/ieom',
    }
    const result = validateEnv(env)
    expect(result.valid).toBe(false)
    expect(result.missing).toContain('GOOGLE_CLIENT_ID')
    expect(result.missing).toContain('GOOGLE_CLIENT_SECRET')
    expect(result.missing).toContain('JWT_SECRET')
    expect(result.missing).not.toContain('PGHOST')
  })

  it('reports only the specific missing variables', () => {
    const env = {
      PGHOST: 'localhost',
      PGDATABASE: 'ieom',
      // Missing PGUSER, PGPASSWORD
      GOOGLE_CLIENT_ID: 'client-id',
      // Missing GOOGLE_CLIENT_SECRET
      JWT_SECRET: 'jwt-secret',
    }
    const result = validateEnv(env)
    expect(result.valid).toBe(false)
    expect(result.missing).toEqual(['PGUSER', 'PGPASSWORD', 'GOOGLE_CLIENT_SECRET'])
  })

  it('treats empty string values as missing', () => {
    const env = {
      ...fullEnv,
      JWT_SECRET: '',
    }
    const result = validateEnv(env)
    expect(result.valid).toBe(false)
    expect(result.missing).toContain('JWT_SECRET')
  })

  it('does not require PG* variables when DATABASE_URL is set even if some PG* are present', () => {
    const env = {
      DATABASE_URL: 'postgres://user:pass@localhost/ieom',
      PGHOST: 'localhost',
      // PGDATABASE intentionally missing — should not matter
      GOOGLE_CLIENT_ID: 'client-id',
      GOOGLE_CLIENT_SECRET: 'client-secret',
      JWT_SECRET: 'jwt-secret',
    }
    const result = validateEnv(env)
    expect(result.valid).toBe(true)
    expect(result.missing).toEqual([])
  })
})
