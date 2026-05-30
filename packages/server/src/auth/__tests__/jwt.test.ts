import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import jwt from 'jsonwebtoken'
import { signAccessToken, verifyAccessToken, signRefreshToken, verifyRefreshToken } from '../jwt.js'
import type { JwtPayload } from '../jwt.js'

describe('JWT utilities', () => {
  const TEST_SECRET = 'test-jwt-secret-key'
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv, JWT_SECRET: TEST_SECRET }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('signAccessToken', () => {
    it('returns a valid JWT string', () => {
      const token = signAccessToken('user-123', 'test@example.com')
      expect(typeof token).toBe('string')
      expect(token.split('.')).toHaveLength(3)
    })

    it('encodes userId as sub and email in the payload', () => {
      const token = signAccessToken('user-123', 'test@example.com')
      const decoded = jwt.verify(token, TEST_SECRET) as jwt.JwtPayload
      expect(decoded.sub).toBe('user-123')
      expect(decoded.email).toBe('test@example.com')
    })

    it('includes iat and exp claims', () => {
      const token = signAccessToken('user-123', 'test@example.com')
      const decoded = jwt.verify(token, TEST_SECRET) as jwt.JwtPayload
      expect(decoded.iat).toBeDefined()
      expect(decoded.exp).toBeDefined()
      expect(decoded.exp!).toBeGreaterThan(decoded.iat!)
    })

    it('uses default 24h expiration', () => {
      const token = signAccessToken('user-123', 'test@example.com')
      const decoded = jwt.verify(token, TEST_SECRET) as jwt.JwtPayload
      const expectedExpiry = decoded.iat! + 24 * 60 * 60
      expect(decoded.exp).toBe(expectedExpiry)
    })

    it('respects JWT_EXPIRATION environment variable', () => {
      process.env.JWT_EXPIRATION = '1h'
      const token = signAccessToken('user-123', 'test@example.com')
      const decoded = jwt.verify(token, TEST_SECRET) as jwt.JwtPayload
      const expectedExpiry = decoded.iat! + 60 * 60
      expect(decoded.exp).toBe(expectedExpiry)
    })

    it('throws if JWT_SECRET is not set', () => {
      delete process.env.JWT_SECRET
      expect(() => signAccessToken('user-123', 'test@example.com')).toThrow('JWT_SECRET environment variable is not set')
    })
  })

  describe('verifyAccessToken', () => {
    it('returns the decoded payload for a valid token', () => {
      const token = signAccessToken('user-456', 'user@test.com')
      const payload = verifyAccessToken(token)
      expect(payload.sub).toBe('user-456')
      expect(payload.email).toBe('user@test.com')
      expect(payload.iat).toBeDefined()
      expect(payload.exp).toBeDefined()
    })

    it('throws for an expired token', () => {
      const token = jwt.sign(
        { sub: 'user-789', email: 'expired@test.com' },
        TEST_SECRET,
        { expiresIn: '0s' }
      )
      // Small delay to ensure expiration
      expect(() => verifyAccessToken(token)).toThrow()
    })

    it('throws for a token signed with a different secret', () => {
      const token = jwt.sign(
        { sub: 'user-789', email: 'wrong@test.com' },
        'wrong-secret',
        { expiresIn: '1h' }
      )
      expect(() => verifyAccessToken(token)).toThrow()
    })

    it('throws for a malformed token', () => {
      expect(() => verifyAccessToken('not-a-valid-token')).toThrow()
    })

    it('throws if JWT_SECRET is not set', () => {
      const token = signAccessToken('user-123', 'test@example.com')
      delete process.env.JWT_SECRET
      expect(() => verifyAccessToken(token)).toThrow('JWT_SECRET environment variable is not set')
    })
  })

  describe('signRefreshToken', () => {
    it('returns a valid JWT string', () => {
      const token = signRefreshToken('user-123')
      expect(typeof token).toBe('string')
      expect(token.split('.')).toHaveLength(3)
    })

    it('encodes userId as sub in the payload', () => {
      const token = signRefreshToken('user-123')
      const decoded = jwt.verify(token, TEST_SECRET) as jwt.JwtPayload
      expect(decoded.sub).toBe('user-123')
    })

    it('does not include email in the payload', () => {
      const token = signRefreshToken('user-123')
      const decoded = jwt.verify(token, TEST_SECRET) as jwt.JwtPayload
      expect(decoded.email).toBeUndefined()
    })

    it('uses default 30d expiration', () => {
      const token = signRefreshToken('user-123')
      const decoded = jwt.verify(token, TEST_SECRET) as jwt.JwtPayload
      const expectedExpiry = decoded.iat! + 30 * 24 * 60 * 60
      expect(decoded.exp).toBe(expectedExpiry)
    })

    it('respects REFRESH_TOKEN_EXPIRATION environment variable', () => {
      process.env.REFRESH_TOKEN_EXPIRATION = '7d'
      const token = signRefreshToken('user-123')
      const decoded = jwt.verify(token, TEST_SECRET) as jwt.JwtPayload
      const expectedExpiry = decoded.iat! + 7 * 24 * 60 * 60
      expect(decoded.exp).toBe(expectedExpiry)
    })

    it('throws if JWT_SECRET is not set', () => {
      delete process.env.JWT_SECRET
      expect(() => signRefreshToken('user-123')).toThrow('JWT_SECRET environment variable is not set')
    })
  })

  describe('verifyRefreshToken', () => {
    it('returns the decoded payload with sub for a valid token', () => {
      const token = signRefreshToken('user-456')
      const payload = verifyRefreshToken(token)
      expect(payload.sub).toBe('user-456')
    })

    it('throws for an expired token', () => {
      const token = jwt.sign(
        { sub: 'user-789' },
        TEST_SECRET,
        { expiresIn: '0s' }
      )
      expect(() => verifyRefreshToken(token)).toThrow()
    })

    it('throws for a token signed with a different secret', () => {
      const token = jwt.sign(
        { sub: 'user-789' },
        'wrong-secret',
        { expiresIn: '7d' }
      )
      expect(() => verifyRefreshToken(token)).toThrow()
    })

    it('throws for a malformed token', () => {
      expect(() => verifyRefreshToken('garbage-token')).toThrow()
    })

    it('throws if JWT_SECRET is not set', () => {
      const token = signRefreshToken('user-123')
      delete process.env.JWT_SECRET
      expect(() => verifyRefreshToken(token)).toThrow('JWT_SECRET environment variable is not set')
    })
  })
})
