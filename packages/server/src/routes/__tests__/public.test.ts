import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'
import { publicRoutes } from '../public.js'

function createMockUserRepo() {
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

describe('publicRoutes', () => {
  let app: FastifyInstance
  let mockUserRepo: ReturnType<typeof createMockUserRepo>

  beforeEach(async () => {
    mockUserRepo = createMockUserRepo()
    app = Fastify()
    await app.register(publicRoutes, { userRepo: mockUserRepo as any })
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
    vi.restoreAllMocks()
  })

  describe('GET /u/:slug/overlay', () => {
    it('returns 404 with user_not_found for invalid slug', async () => {
      mockUserRepo.findBySlug.mockResolvedValue(null)

      const response = await app.inject({
        method: 'GET',
        url: '/u/nonexistent-user/overlay',
      })

      expect(response.statusCode).toBe(404)
      expect(response.json()).toEqual({ error: 'user_not_found' })
      expect(mockUserRepo.findBySlug).toHaveBeenCalledWith('nonexistent-user')
    })

    it('returns 200 with HTML for valid slug', async () => {
      const mockUser = {
        id: 'user-uuid-123',
        googleId: 'google-123',
        email: 'test@example.com',
        displayName: 'Test User',
        avatarUrl: null,
        slug: 'test-user',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      mockUserRepo.findBySlug.mockResolvedValue(mockUser)

      const response = await app.inject({
        method: 'GET',
        url: '/u/test-user/overlay',
      })

      expect(response.statusCode).toBe(200)
      expect(response.headers['content-type']).toContain('text/html')
      expect(response.body).toContain('data-user-id="user-uuid-123"')
      expect(mockUserRepo.findBySlug).toHaveBeenCalledWith('test-user')
    })

    it('resolves slug and attaches userId to request', async () => {
      const mockUser = {
        id: 'resolved-user-id',
        googleId: 'google-456',
        email: 'user@example.com',
        displayName: 'Another User',
        avatarUrl: 'https://example.com/avatar.png',
        slug: 'another-user',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      mockUserRepo.findBySlug.mockResolvedValue(mockUser)

      const response = await app.inject({
        method: 'GET',
        url: '/u/another-user/overlay',
      })

      expect(response.statusCode).toBe(200)
      expect(response.body).toContain('data-user-id="resolved-user-id"')
    })
  })

  describe('GET /u/:slug/player', () => {
    it('returns 404 with user_not_found for invalid slug', async () => {
      mockUserRepo.findBySlug.mockResolvedValue(null)

      const response = await app.inject({
        method: 'GET',
        url: '/u/bad-slug/player',
      })

      expect(response.statusCode).toBe(404)
      expect(response.json()).toEqual({ error: 'user_not_found' })
      expect(mockUserRepo.findBySlug).toHaveBeenCalledWith('bad-slug')
    })

    it('returns 200 with HTML for valid slug', async () => {
      const mockUser = {
        id: 'player-user-id',
        googleId: 'google-789',
        email: 'player@example.com',
        displayName: 'Player User',
        avatarUrl: null,
        slug: 'player-user',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      mockUserRepo.findBySlug.mockResolvedValue(mockUser)

      const response = await app.inject({
        method: 'GET',
        url: '/u/player-user/player',
      })

      expect(response.statusCode).toBe(200)
      expect(response.headers['content-type']).toContain('text/html')
      expect(response.body).toContain('data-user-id="player-user-id"')
      expect(mockUserRepo.findBySlug).toHaveBeenCalledWith('player-user')
    })

    it('resolves slug and attaches userId to request', async () => {
      const mockUser = {
        id: 'another-resolved-id',
        googleId: 'google-abc',
        email: 'another@example.com',
        displayName: 'Yet Another User',
        avatarUrl: null,
        slug: 'yet-another',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      mockUserRepo.findBySlug.mockResolvedValue(mockUser)

      const response = await app.inject({
        method: 'GET',
        url: '/u/yet-another/player',
      })

      expect(response.statusCode).toBe(200)
      expect(response.body).toContain('data-user-id="another-resolved-id"')
    })
  })

  describe('slug resolution', () => {
    it('calls findBySlug with the exact slug from the URL', async () => {
      mockUserRepo.findBySlug.mockResolvedValue(null)

      await app.inject({
        method: 'GET',
        url: '/u/my-custom-slug/overlay',
      })

      expect(mockUserRepo.findBySlug).toHaveBeenCalledWith('my-custom-slug')
    })

    it('handles slugs with hyphens correctly', async () => {
      const mockUser = {
        id: 'hyphen-user-id',
        googleId: 'google-hyp',
        email: 'hyphen@example.com',
        displayName: 'Hyphen User',
        avatarUrl: null,
        slug: 'my-long-slug-name',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      mockUserRepo.findBySlug.mockResolvedValue(mockUser)

      const response = await app.inject({
        method: 'GET',
        url: '/u/my-long-slug-name/overlay',
      })

      expect(response.statusCode).toBe(200)
      expect(mockUserRepo.findBySlug).toHaveBeenCalledWith('my-long-slug-name')
    })

    it('does not require authentication', async () => {
      const mockUser = {
        id: 'public-user-id',
        googleId: 'google-pub',
        email: 'public@example.com',
        displayName: 'Public User',
        avatarUrl: null,
        slug: 'public-user',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      mockUserRepo.findBySlug.mockResolvedValue(mockUser)

      // No Authorization header — should still work
      const response = await app.inject({
        method: 'GET',
        url: '/u/public-user/overlay',
      })

      expect(response.statusCode).toBe(200)
    })
  })
})
