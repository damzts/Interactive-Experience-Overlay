import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateSlug, appendSlugSuffix, UserRepository } from '../repositories/UserRepository.js'
import type { GoogleProfile } from '../../auth/googleOAuth.js'

describe('generateSlug', () => {
  it('converts display name to lowercase with hyphens', () => {
    expect(generateSlug('John Doe')).toBe('john-doe')
  })

  it('replaces non-alphanumeric characters with hyphens', () => {
    expect(generateSlug('Hello World!')).toBe('hello-world')
  })

  it('collapses consecutive hyphens', () => {
    expect(generateSlug('foo---bar')).toBe('foo-bar')
  })

  it('removes leading and trailing hyphens', () => {
    expect(generateSlug('--hello--')).toBe('hello')
  })

  it('truncates to max 20 characters', () => {
    const slug = generateSlug('this is a very long display name that exceeds twenty chars')
    expect(slug.length).toBeLessThanOrEqual(20)
  })

  it('removes trailing hyphen after truncation', () => {
    const slug = generateSlug('abcdefghijklmnopqrst-uvwxyz')
    expect(slug).not.toMatch(/-$/)
  })

  it('returns "user" for empty string', () => {
    expect(generateSlug('')).toBe('user')
  })

  it('returns "user" for string with only special characters', () => {
    expect(generateSlug('!!!@@@')).toBe('user')
  })

  it('handles single character names', () => {
    expect(generateSlug('A')).toBe('a')
  })

  it('handles unicode characters by replacing them', () => {
    expect(generateSlug('Ñoño')).toBe('o-o')
  })

  it('produces slug matching the required pattern for normal names', () => {
    const slug = generateSlug('John Doe')
    expect(slug).toMatch(/^[a-z0-9][a-z0-9\-]*[a-z0-9]$/)
  })
})

describe('appendSlugSuffix', () => {
  it('appends a hyphen and random suffix', () => {
    const result = appendSlugSuffix('john-doe')
    expect(result).toMatch(/^john-doe-[a-z0-9]+$/)
  })

  it('keeps total length reasonable', () => {
    const result = appendSlugSuffix('a-very-long-base-slug-name')
    expect(result.length).toBeLessThanOrEqual(20)
  })

  it('produces different results on successive calls', () => {
    const results = new Set(Array.from({ length: 10 }, () => appendSlugSuffix('test')))
    // With random suffixes, we should get multiple unique values
    expect(results.size).toBeGreaterThan(1)
  })
})

describe('UserRepository', () => {
  let mockPool: {
    query: ReturnType<typeof vi.fn>
  }
  let repo: UserRepository

  const mockUserRow = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    google_id: 'google-123',
    email: 'test@example.com',
    display_name: 'Test User',
    avatar_url: 'https://example.com/avatar.jpg',
    slug: 'test-user',
    refresh_token_hash: null,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
  }

  beforeEach(() => {
    mockPool = {
      query: vi.fn(),
    }
    repo = new UserRepository(mockPool as any)
  })

  describe('findByGoogleId', () => {
    it('returns user record when found', async () => {
      mockPool.query.mockResolvedValue({ rows: [mockUserRow] })
      const result = await repo.findByGoogleId('google-123')
      expect(result).toEqual({
        id: mockUserRow.id,
        googleId: 'google-123',
        email: 'test@example.com',
        displayName: 'Test User',
        avatarUrl: 'https://example.com/avatar.jpg',
        slug: 'test-user',
        createdAt: mockUserRow.created_at,
        updatedAt: mockUserRow.updated_at,
      })
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE google_id = $1',
        ['google-123']
      )
    })

    it('returns null when not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] })
      const result = await repo.findByGoogleId('nonexistent')
      expect(result).toBeNull()
    })
  })

  describe('findBySlug', () => {
    it('returns user record when found', async () => {
      mockPool.query.mockResolvedValue({ rows: [mockUserRow] })
      const result = await repo.findBySlug('test-user')
      expect(result).not.toBeNull()
      expect(result!.slug).toBe('test-user')
    })

    it('returns null when not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] })
      const result = await repo.findBySlug('nonexistent')
      expect(result).toBeNull()
    })
  })

  describe('findById', () => {
    it('returns user record when found', async () => {
      mockPool.query.mockResolvedValue({ rows: [mockUserRow] })
      const result = await repo.findById(mockUserRow.id)
      expect(result).not.toBeNull()
      expect(result!.id).toBe(mockUserRow.id)
    })

    it('returns null when not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] })
      const result = await repo.findById('nonexistent-id')
      expect(result).toBeNull()
    })
  })

  describe('upsertFromGoogle', () => {
    const profile: GoogleProfile = {
      googleId: 'google-123',
      email: 'test@example.com',
      name: 'Test User',
      picture: 'https://example.com/avatar.jpg',
    }

    it('updates existing user when google_id matches', async () => {
      // First call: findByGoogleId (SELECT)
      mockPool.query
        .mockResolvedValueOnce({ rows: [mockUserRow] })
        // Second call: UPDATE
        .mockResolvedValueOnce({ rows: [{ ...mockUserRow, display_name: 'Test User' }] })

      const result = await repo.upsertFromGoogle(profile)
      expect(result.googleId).toBe('google-123')
      expect(mockPool.query).toHaveBeenCalledTimes(2)
    })

    it('creates new user when google_id does not exist', async () => {
      // First call: findByGoogleId (SELECT) — not found
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        // Second call: INSERT — success
        .mockResolvedValueOnce({ rows: [mockUserRow] })

      const result = await repo.upsertFromGoogle(profile)
      expect(result.googleId).toBe('google-123')
    })

    it('retries with suffix on slug collision', async () => {
      const slugError = new Error('duplicate key') as Error & { code: string; constraint: string }
      slugError.code = '23505'
      slugError.constraint = 'idx_users_slug'

      // findByGoogleId — not found
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        // First INSERT — slug collision
        .mockRejectedValueOnce(slugError)
        // Second INSERT — success
        .mockResolvedValueOnce({ rows: [{ ...mockUserRow, slug: 'test-user-ab12' }] })

      const result = await repo.upsertFromGoogle(profile)
      expect(result).not.toBeNull()
      expect(mockPool.query).toHaveBeenCalledTimes(3)
    })

    it('throws after max retries on persistent slug collision', async () => {
      const slugError = new Error('duplicate key') as Error & { code: string; constraint: string }
      slugError.code = '23505'
      slugError.constraint = 'idx_users_slug'

      // findByGoogleId — not found
      mockPool.query.mockResolvedValueOnce({ rows: [] })
      // All INSERTs fail with slug collision
      for (let i = 0; i < 6; i++) {
        mockPool.query.mockRejectedValueOnce(slugError)
      }

      await expect(repo.upsertFromGoogle(profile)).rejects.toThrow(
        'Failed to generate unique slug after 5 retries'
      )
    })

    it('rethrows non-slug-collision errors', async () => {
      const otherError = new Error('connection error') as Error & { code: string; constraint: string }
      otherError.code = '08001'
      otherError.constraint = ''

      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockRejectedValueOnce(otherError)

      await expect(repo.upsertFromGoogle(profile)).rejects.toThrow('connection error')
    })
  })

  describe('storeRefreshTokenHash', () => {
    it('updates the refresh_token_hash for the user', async () => {
      mockPool.query.mockResolvedValue({ rows: [] })
      await repo.storeRefreshTokenHash('user-id', 'hashed-token')
      expect(mockPool.query).toHaveBeenCalledWith(
        'UPDATE users SET refresh_token_hash = $1, updated_at = NOW() WHERE id = $2',
        ['hashed-token', 'user-id']
      )
    })
  })

  describe('getRefreshTokenHash', () => {
    it('returns the hash when present', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ refresh_token_hash: 'hashed-token' }] })
      const result = await repo.getRefreshTokenHash('user-id')
      expect(result).toBe('hashed-token')
    })

    it('returns null when no hash stored', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ refresh_token_hash: null }] })
      const result = await repo.getRefreshTokenHash('user-id')
      expect(result).toBeNull()
    })

    it('returns null when user not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] })
      const result = await repo.getRefreshTokenHash('nonexistent')
      expect(result).toBeNull()
    })
  })

  describe('invalidateRefreshToken', () => {
    it('sets refresh_token_hash to NULL', async () => {
      mockPool.query.mockResolvedValue({ rows: [] })
      await repo.invalidateRefreshToken('user-id')
      expect(mockPool.query).toHaveBeenCalledWith(
        'UPDATE users SET refresh_token_hash = NULL, updated_at = NOW() WHERE id = $1',
        ['user-id']
      )
    })
  })
})
