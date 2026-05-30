import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ObsConfigRepository } from '../ObsConfigRepository.js'

function createMockPool() {
  return {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    connect: vi.fn(),
  }
}

describe('ObsConfigRepository', () => {
  let repo: ObsConfigRepository
  let mockPool: ReturnType<typeof createMockPool>

  beforeEach(() => {
    mockPool = createMockPool()
    repo = new ObsConfigRepository(mockPool as any)
  })

  describe('find', () => {
    it('queries with user_id and returns config', async () => {
      const userId = 'user-obs'
      mockPool.query.mockResolvedValueOnce({
        rows: [{ url: 'ws://myobs:4455', password: 'secret123' }],
      })

      const result = await repo.find(userId)

      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT url, password FROM obs_config WHERE user_id = $1',
        [userId]
      )
      expect(result).toEqual({ url: 'ws://myobs:4455', password: 'secret123' })
    })

    it('returns defaults when no config exists', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] })
      const result = await repo.find('user-new')
      expect(result).toEqual({ url: 'ws://localhost:4455', password: '' })
    })
  })

  describe('save', () => {
    it('upserts obs config with user_id', async () => {
      const userId = 'user-save'
      const cfg = { url: 'ws://remote:4455', password: 'pass' }

      await repo.save(userId, cfg)

      const [sql, params] = mockPool.query.mock.calls[0]
      expect(sql).toContain('INSERT INTO obs_config')
      expect(sql).toContain('ON CONFLICT (user_id) DO UPDATE')
      expect(params).toEqual([userId, cfg.url, cfg.password])
    })
  })
})
