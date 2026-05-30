import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'
import fastifyCookie from '@fastify/cookie'
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { authRoutes } from '../authRoutes.js'
import { signAccessToken, signRefreshToken } from '../jwt.js'

// Mock googleOAuth module
vi.mock('../googleOAuth.js', () => ({
  getAuthorizationUrl: vi.fn(() => 'https://accounts.google.com/o/oauth2/v2/auth?mock=true'),
  exchangeCodeForTokens: vi.fn(),
  extractProfile: vi.fn(),
}))

import { getAuthorizationUrl, exchangeCodeForTokens, extractProfile } from '../googleOAuth.js'

const TEST_SECRET = 'test-jwt-secret-key'

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function createMockUserRepository() {
  return {
    findByGoogleId: vi.fn(),
    findBySlug: vi.fn(),
    findById: vi.fn(),
    upsertFromGoogle: vi.fn(),
    storeRefreshTokenHash: vi.fn(),
    getRefreshTokenHash: vi.fn(),
    invalidateRefreshToken: vi.fn(),
  }
}

describe('authRoutes', () => {
  let app: FastifyInstance
  let mockUserRepo: ReturnType<typeof createMockUserRepository>
  const originalEnv = process.env

  beforeEach(async () => {
    process.env = {
      ...originalEnv,
      JWT_SECRET: TEST_SECRET,
      GOOGLE_CLIENT_ID: 'test-client-id',
      GOOGLE_CLIENT_SECRET: 'test-client-secret',
      GOOGLE_REDIRECT_URI: 'http://localhost:3000/auth/google/callback',
    }

    mockUserRepo = createMockUserRepository()
    app = Fastify()
    await app.register(fastifyCookie)
    await app.register(authRoutes, { userRepository: mockUserRepo as any })
    await app.ready()
  })

  afterEach(async () => {
    process.env = originalEnv
    await app.close()
    vi.restoreAllMocks()
  })

  describe('GET /auth/google', () => {
    it('redirects to Google authorization URL', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/auth/google',
      })

      expect(response.statusCode).toBe(302)
      expect(response.headers.location).toBe('https://accounts.google.com/o/oauth2/v2/auth?mock=true')
    })
  })

  describe('GET /auth/google/callback', () => {
    it('redirects to login with error when no code is provided', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/auth/google/callback',
      })

      expect(response.statusCode).toBe(302)
      expect(response.headers.location).toBe('/admin?error=oauth_failed')
    })

    it('redirects to login with error when Google returns an error', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/auth/google/callback?error=access_denied',
      })

      expect(response.statusCode).toBe(302)
      expect(response.headers.location).toBe('/admin?error=oauth_failed')
    })

    it('exchanges code, upserts user, sets cookies, and redirects to /admin on success', async () => {
      const mockUser = {
        id: 'user-uuid-123',
        googleId: 'google-123',
        email: 'test@example.com',
        displayName: 'Test User',
        avatarUrl: 'https://example.com/avatar.jpg',
        slug: 'test-user',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(exchangeCodeForTokens).mockResolvedValue({
        idToken: 'mock-id-token',
        accessToken: 'mock-access-token',
      })
      vi.mocked(extractProfile).mockResolvedValue({
        googleId: 'google-123',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/avatar.jpg',
      })
      mockUserRepo.upsertFromGoogle.mockResolvedValue(mockUser)
      mockUserRepo.storeRefreshTokenHash.mockResolvedValue(undefined)

      const response = await app.inject({
        method: 'GET',
        url: '/auth/google/callback?code=auth-code-123',
      })

      expect(response.statusCode).toBe(302)
      const location = response.headers.location as string
      // Should redirect to /admin with no tokens in URL
      expect(location).toBe('/admin')

      // Verify cookies are set
      const cookies = response.cookies
      const accessCookie = cookies.find((c: any) => c.name === 'access_token')
      const refreshCookie = cookies.find((c: any) => c.name === 'refresh_token')
      const csrfCookie = cookies.find((c: any) => c.name === 'csrf_token')

      expect(accessCookie).toBeDefined()
      expect(accessCookie!.httpOnly).toBe(true)
      expect(refreshCookie).toBeDefined()
      expect(refreshCookie!.httpOnly).toBe(true)
      expect(csrfCookie).toBeDefined()
      // CSRF cookie should NOT be httpOnly (so JS can read it)
      expect(csrfCookie!.httpOnly).toBeFalsy()

      // Verify upsert was called with the extracted profile
      expect(mockUserRepo.upsertFromGoogle).toHaveBeenCalledWith({
        googleId: 'google-123',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/avatar.jpg',
      })

      // Verify refresh token hash was stored
      expect(mockUserRepo.storeRefreshTokenHash).toHaveBeenCalledWith(
        'user-uuid-123',
        expect.any(String)
      )
    })

    it('redirects to login with error when token exchange fails', async () => {
      vi.mocked(exchangeCodeForTokens).mockRejectedValue(new Error('Token exchange failed'))

      const response = await app.inject({
        method: 'GET',
        url: '/auth/google/callback?code=bad-code',
      })

      expect(response.statusCode).toBe(302)
      expect(response.headers.location).toBe('/admin?error=oauth_failed')
    })

    it('redirects to login with error when profile extraction fails', async () => {
      vi.mocked(exchangeCodeForTokens).mockResolvedValue({
        idToken: 'mock-id-token',
        accessToken: 'mock-access-token',
      })
      vi.mocked(extractProfile).mockRejectedValue(new Error('Invalid ID token'))

      const response = await app.inject({
        method: 'GET',
        url: '/auth/google/callback?code=auth-code-123',
      })

      expect(response.statusCode).toBe(302)
      expect(response.headers.location).toBe('/admin?error=oauth_failed')
    })
  })

  describe('GET /auth/google with desktop redirect', () => {
    it('redirects desktop clients using state so Electron can capture the token', async () => {
      vi.mocked(exchangeCodeForTokens).mockResolvedValue({
        idToken: 'mock-id-token',
        accessToken: 'mock-access-token',
      })
      vi.mocked(extractProfile).mockResolvedValue({
        googleId: 'google-123',
        email: 'test@example.com',
        name: 'Test User',
        picture: null,
      })
      mockUserRepo.upsertFromGoogle.mockResolvedValue({
        id: 'user-uuid-123',
        googleId: 'google-123',
        email: 'test@example.com',
        displayName: 'Test User',
        avatarUrl: null,
        slug: 'test-user',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      mockUserRepo.storeRefreshTokenHash.mockResolvedValue(undefined)

      const response = await app.inject({
        method: 'GET',
        url: '/auth/google/callback?code=auth-code-123&state=ieom%3A%2F%2Fauth',
      })

      expect(response.statusCode).toBe(302)
      expect(response.headers.location).toContain('ieom://auth')
      expect(response.headers.location).toContain('token=')
    })
  })

  describe('POST /auth/refresh', () => {
    it('returns 401 when no refresh_token cookie is provided', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
      })

      expect(response.statusCode).toBe(401)
      expect(response.json()).toEqual({ error: 'refresh_invalid' })
    })

    it('returns 401 when refresh token cookie is expired or invalid', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        cookies: { refresh_token: 'invalid-token' },
      })

      expect(response.statusCode).toBe(401)
      expect(response.json()).toEqual({ error: 'refresh_invalid' })
    })

    it('returns 401 when stored hash does not match', async () => {
      const refreshToken = signRefreshToken('user-123')
      mockUserRepo.getRefreshTokenHash.mockResolvedValue('different-hash-value')

      const response = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        cookies: { refresh_token: refreshToken },
      })

      expect(response.statusCode).toBe(401)
      expect(response.json()).toEqual({ error: 'refresh_invalid' })
    })

    it('returns 401 when no stored hash exists (already invalidated)', async () => {
      const refreshToken = signRefreshToken('user-123')
      mockUserRepo.getRefreshTokenHash.mockResolvedValue(null)

      const response = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        cookies: { refresh_token: refreshToken },
      })

      expect(response.statusCode).toBe(401)
      expect(response.json()).toEqual({ error: 'refresh_invalid' })
    })

    it('issues new cookies and invalidates old on valid refresh', async () => {
      const refreshToken = signRefreshToken('user-123')
      const storedHash = hashToken(refreshToken)

      mockUserRepo.getRefreshTokenHash.mockResolvedValue(storedHash)
      mockUserRepo.invalidateRefreshToken.mockResolvedValue(undefined)
      mockUserRepo.findById.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        googleId: 'google-123',
        avatarUrl: null,
        slug: 'test-user',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      mockUserRepo.storeRefreshTokenHash.mockResolvedValue(undefined)

      const response = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        cookies: { refresh_token: refreshToken },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json()).toEqual({ success: true })

      // Verify new cookies are set
      const cookies = response.cookies
      const accessCookie = cookies.find((c: any) => c.name === 'access_token')
      const newRefreshCookie = cookies.find((c: any) => c.name === 'refresh_token')
      const csrfCookie = cookies.find((c: any) => c.name === 'csrf_token')

      expect(accessCookie).toBeDefined()
      expect(newRefreshCookie).toBeDefined()
      expect(csrfCookie).toBeDefined()

      // Verify old token was invalidated
      expect(mockUserRepo.invalidateRefreshToken).toHaveBeenCalledWith('user-123')

      // Verify new hash was stored
      expect(mockUserRepo.storeRefreshTokenHash).toHaveBeenCalledWith(
        'user-123',
        expect.any(String)
      )
    })

    it('returns 401 when user is not found', async () => {
      const refreshToken = signRefreshToken('user-123')
      const storedHash = hashToken(refreshToken)

      mockUserRepo.getRefreshTokenHash.mockResolvedValue(storedHash)
      mockUserRepo.invalidateRefreshToken.mockResolvedValue(undefined)
      mockUserRepo.findById.mockResolvedValue(null)

      const response = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        cookies: { refresh_token: refreshToken },
      })

      expect(response.statusCode).toBe(401)
      expect(response.json()).toEqual({ error: 'refresh_invalid' })
    })
  })

  describe('POST /auth/logout', () => {
    it('returns 401 when no access_token cookie is provided', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/logout',
      })

      expect(response.statusCode).toBe(401)
      expect(response.json()).toEqual({ error: 'unauthorized' })
    })

    it('returns 401 when access_token cookie is invalid', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/logout',
        cookies: { access_token: 'invalid-token' },
      })

      expect(response.statusCode).toBe(401)
      expect(response.json()).toEqual({ error: 'unauthorized' })
    })

    it('returns 401 when access_token cookie is signed with wrong secret', async () => {
      const badToken = jwt.sign(
        { sub: 'user-123', email: 'test@example.com' },
        'wrong-secret',
        { expiresIn: '1h' },
      )

      const response = await app.inject({
        method: 'POST',
        url: '/auth/logout',
        cookies: { access_token: badToken },
      })

      expect(response.statusCode).toBe(401)
      expect(response.json()).toEqual({ error: 'unauthorized' })
    })

    it('invalidates refresh token, clears cookies, and returns success on valid token', async () => {
      const accessToken = signAccessToken('user-123', 'test@example.com')
      mockUserRepo.invalidateRefreshToken.mockResolvedValue(undefined)

      const response = await app.inject({
        method: 'POST',
        url: '/auth/logout',
        cookies: { access_token: accessToken },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json()).toEqual({ success: true })
      expect(mockUserRepo.invalidateRefreshToken).toHaveBeenCalledWith('user-123')

      // Verify cookies are cleared (maxAge=0 or expired)
      const cookies = response.cookies
      const accessCookie = cookies.find((c: any) => c.name === 'access_token')
      const refreshCookie = cookies.find((c: any) => c.name === 'refresh_token')
      const csrfCookie = cookies.find((c: any) => c.name === 'csrf_token')

      expect(accessCookie).toBeDefined()
      expect(refreshCookie).toBeDefined()
      expect(csrfCookie).toBeDefined()
    })
  })
})
