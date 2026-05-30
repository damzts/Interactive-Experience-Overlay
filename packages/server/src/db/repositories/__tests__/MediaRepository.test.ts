import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MediaRepository } from '../MediaRepository.js'

function createMockPool() {
  const mockClient = {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    release: vi.fn(),
  }
  const mockPool = {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    connect: vi.fn().mockResolvedValue(mockClient),
  }
  return { mockPool, mockClient }
}

describe('MediaRepository', () => {
  let repo: MediaRepository
  let mockPool: ReturnType<typeof createMockPool>['mockPool']
  let mockClient: ReturnType<typeof createMockPool>['mockClient']

  beforeEach(() => {
    const mocks = createMockPool()
    mockPool = mocks.mockPool
    mockClient = mocks.mockClient
    repo = new MediaRepository(mockPool as any)
  })

  describe('findAll', () => {
    it('queries with user_id and returns media entries', async () => {
      const userId = 'user-media'
      mockPool.query.mockResolvedValueOnce({
        rows: [
          { id: 'm1', user_id: userId, name: 'Video.mp4', type: 'video', url: '/videos/v.mp4', duration: 5000 },
          { id: 'm2', user_id: userId, name: 'Image.png', type: 'image', url: '/img/i.png', duration: null },
        ],
      })

      const result = await repo.findAll(userId)

      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM media_library WHERE user_id = $1 ORDER BY id',
        [userId]
      )
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({ id: 'm1', name: 'Video.mp4', type: 'video', url: '/videos/v.mp4', duration: 5000 })
      expect(result[1].duration).toBeUndefined()
    })
  })

  describe('save', () => {
    it('upserts a media entry with user_id', async () => {
      const userId = 'user-save'
      const entry = { id: 'm1', name: 'Video.mp4', type: 'video' as const, url: '/vid/v.mp4', duration: 10000 }

      await repo.save(userId, entry)

      const [sql, params] = mockPool.query.mock.calls[0]
      expect(sql).toContain('INSERT INTO media_library')
      expect(sql).toContain('ON CONFLICT (user_id, id) DO UPDATE')
      expect(params).toEqual(['m1', userId, 'Video.mp4', 'video', '/vid/v.mp4', 10000])
    })

    it('handles undefined duration as null', async () => {
      const entry = { id: 'm2', name: 'Img.png', type: 'image' as const, url: '/img.png', duration: undefined }
      await repo.save('user-1', entry)
      const params = mockPool.query.mock.calls[0][1]
      expect(params[5]).toBeNull()
    })
  })

  describe('saveAll', () => {
    it('replaces all media for user in a transaction', async () => {
      const userId = 'user-bulk'
      const entries = [
        { id: 'm1', name: 'A', type: 'video' as const, url: '/a', duration: 1000 },
      ]

      await repo.saveAll(userId, entries)

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN')
      expect(mockClient.query).toHaveBeenCalledWith(
        'DELETE FROM media_library WHERE user_id = $1',
        [userId]
      )
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT')
      expect(mockClient.release).toHaveBeenCalled()
    })
  })

  describe('delete', () => {
    it('deletes a media entry scoped to user_id', async () => {
      await repo.delete('user-del', 'm1')
      expect(mockPool.query).toHaveBeenCalledWith(
        'DELETE FROM media_library WHERE user_id = $1 AND id = $2',
        ['user-del', 'm1']
      )
    })
  })
})
