import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PovFeedsRepository } from '../povFeedsRepo.js'

function createMockPool() {
  return {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    connect: vi.fn(),
  }
}

describe('PovFeedsRepository', () => {
  let repo: PovFeedsRepository
  let mockPool: ReturnType<typeof createMockPool>

  beforeEach(() => {
    mockPool = createMockPool()
    repo = new PovFeedsRepository(mockPool as any)
  })

  describe('getAllFeeds', () => {
    it('queries with user_id and returns feeds', async () => {
      const userId = 'user-feeds'
      mockPool.query.mockResolvedValueOnce({
        rows: [
          { id: 'f1', user_id: userId, label: 'Cam 1', obs_address: 'ws://cam1:4455', obs_password: 'pass1', scene_name: 'Main', registered_at: 1000 },
        ],
      })

      const result = await repo.getAllFeeds(userId)

      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM pov_feeds WHERE user_id = $1 ORDER BY registered_at',
        [userId]
      )
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('f1')
    })
  })

  describe('getFeedById', () => {
    it('queries with user_id and id', async () => {
      const userId = 'user-1'
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'f1', user_id: userId, label: 'Cam', obs_address: 'ws://a', obs_password: 'p', scene_name: 'S', registered_at: 100 }],
      })

      const result = await repo.getFeedById(userId, 'f1')

      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM pov_feeds WHERE user_id = $1 AND id = $2',
        [userId, 'f1']
      )
      expect(result?.id).toBe('f1')
    })

    it('returns undefined when not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] })
      const result = await repo.getFeedById('user-1', 'nonexistent')
      expect(result).toBeUndefined()
    })
  })

  describe('getFeedByAddress', () => {
    it('queries with user_id and address', async () => {
      const userId = 'user-1'
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'f1', user_id: userId, label: 'Cam', obs_address: 'ws://cam:4455', obs_password: 'p', scene_name: 'S', registered_at: 100 }],
      })

      const result = await repo.getFeedByAddress(userId, 'ws://cam:4455')

      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM pov_feeds WHERE user_id = $1 AND obs_address = $2',
        [userId, 'ws://cam:4455']
      )
      expect(result?.obs_address).toBe('ws://cam:4455')
    })
  })

  describe('insertFeed', () => {
    it('inserts a feed with user_id', async () => {
      const userId = 'user-insert'
      const feed = { id: 'f1', label: 'New Cam', obsAddress: 'ws://new:4455', obsPassword: 'secret', sceneName: 'Main', registeredAt: Date.now() }

      await repo.insertFeed(userId, feed)

      const [sql, params] = mockPool.query.mock.calls[0]
      expect(sql).toContain('INSERT INTO pov_feeds')
      expect(params[0]).toBe('f1')
      expect(params[1]).toBe(userId)
      expect(params[2]).toBe('New Cam')
    })
  })

  describe('updateFeed', () => {
    it('updates specified fields scoped to user_id and id', async () => {
      const userId = 'user-update'
      await repo.updateFeed(userId, 'f1', { label: 'Updated', obsAddress: 'ws://updated:4455' })

      const [sql, params] = mockPool.query.mock.calls[0]
      expect(sql).toContain('UPDATE pov_feeds SET')
      expect(sql).toContain('WHERE user_id = $1 AND id = $2')
      expect(params[0]).toBe(userId)
      expect(params[1]).toBe('f1')
      expect(params[2]).toBe('Updated')
      expect(params[3]).toBe('ws://updated:4455')
    })

    it('does nothing when no fields provided', async () => {
      await repo.updateFeed('user-1', 'f1', {})
      expect(mockPool.query).not.toHaveBeenCalled()
    })
  })

  describe('deleteFeed', () => {
    it('deletes a feed scoped to user_id', async () => {
      await repo.deleteFeed('user-del', 'f1')
      expect(mockPool.query).toHaveBeenCalledWith(
        'DELETE FROM pov_feeds WHERE user_id = $1 AND id = $2',
        ['user-del', 'f1']
      )
    })
  })
})
