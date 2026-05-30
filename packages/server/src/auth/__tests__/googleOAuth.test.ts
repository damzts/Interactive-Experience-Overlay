import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getAuthorizationUrl, exchangeCodeForTokens, extractProfile } from '../googleOAuth.js'

describe('googleOAuth', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      GOOGLE_CLIENT_ID: 'test-client-id',
      GOOGLE_CLIENT_SECRET: 'test-client-secret',
      GOOGLE_REDIRECT_URI: 'http://localhost:3000/auth/google/callback',
    }
  })

  afterEach(() => {
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  describe('getAuthorizationUrl', () => {
    it('should return a URL containing the client_id', () => {
      const url = getAuthorizationUrl()
      expect(url).toContain('client_id=test-client-id')
    })

    it('should return a URL containing the redirect_uri', () => {
      const url = getAuthorizationUrl()
      expect(url).toContain('redirect_uri=')
      expect(url).toContain(encodeURIComponent('http://localhost:3000/auth/google/callback'))
    })

    it('should request openid, email, and profile scopes', () => {
      const url = getAuthorizationUrl()
      expect(url).toContain('scope=')
      // Scopes are space-separated and URL-encoded
      expect(url).toContain('openid')
      expect(url).toContain('email')
      expect(url).toContain('profile')
    })

    it('should point to Google accounts OAuth endpoint', () => {
      const url = getAuthorizationUrl()
      expect(url).toContain('https://accounts.google.com/o/oauth2')
    })

    it('should throw if GOOGLE_CLIENT_ID is missing', () => {
      delete process.env.GOOGLE_CLIENT_ID
      expect(() => getAuthorizationUrl()).toThrow('Missing Google OAuth environment variables')
    })

    it('should throw if GOOGLE_CLIENT_SECRET is missing', () => {
      delete process.env.GOOGLE_CLIENT_SECRET
      expect(() => getAuthorizationUrl()).toThrow('Missing Google OAuth environment variables')
    })

    it('should throw if GOOGLE_REDIRECT_URI is missing', () => {
      delete process.env.GOOGLE_REDIRECT_URI
      expect(() => getAuthorizationUrl()).toThrow('Missing Google OAuth environment variables')
    })
  })

  describe('exchangeCodeForTokens', () => {
    it('should throw an error when token exchange fails', async () => {
      // With a fake code, the exchange will fail against Google's real endpoint
      await expect(exchangeCodeForTokens('invalid-code')).rejects.toThrow()
    })

    it('should throw if environment variables are missing', async () => {
      delete process.env.GOOGLE_CLIENT_ID
      await expect(exchangeCodeForTokens('some-code')).rejects.toThrow(
        'Missing Google OAuth environment variables'
      )
    })
  })

  describe('extractProfile', () => {
    it('should throw if GOOGLE_CLIENT_ID is missing', async () => {
      delete process.env.GOOGLE_CLIENT_ID
      await expect(extractProfile('some-token')).rejects.toThrow(
        'Missing GOOGLE_CLIENT_ID environment variable'
      )
    })

    it('should throw for an invalid ID token', async () => {
      await expect(extractProfile('invalid-token')).rejects.toThrow()
    })
  })
})
