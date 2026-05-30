import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AmbianceRepository } from '../AmbianceRepository.js'

function createMockPool() {
  return {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    connect: vi.fn(),
  }
}

describe('AmbianceRepository', () => {
  let repo: AmbianceRepository
  let mockPool: ReturnType<typeof createMockPool>

  beforeEach(() => {
    mockPool = createMockPool()
    repo = new AmbianceRepository(mockPool as any)
  })

  describe('find', () => {
    it('queries with user_id and returns ambiance config', async () => {
      const userId = 'user-amb'
      mockPool.query.mockResolvedValueOnce({
        rows: [{ simulation_json: { type: 'rain', intensity: 0.5 } }],
      })

      const result = await repo.find(userId)

      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT simulation_json FROM desktop_ambiance WHERE user_id = $1',
        [userId]
      )
      expect(result).toEqual({ widgetSimulation: { type: 'rain', intensity: 0.5 } })
    })

    it('returns undefined when no config exists', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] })
      const result = await repo.find('user-new')
      expect(result).toBeUndefined()
    })

    it('returns undefined when simulation_json is null', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ simulation_json: null }] })
      const result = await repo.find('user-null')
      expect(result).toBeUndefined()
    })
  })

  describe('save', () => {
    it('upserts ambiance config with user_id', async () => {
      const userId = 'user-save'
      const cfg = { widgetSimulation: { type: 'snow', intensity: 0.8 } }

      await repo.save(userId, cfg as any)

      const [sql, params] = mockPool.query.mock.calls[0]
      expect(sql).toContain('INSERT INTO desktop_ambiance')
      expect(sql).toContain('ON CONFLICT (user_id) DO UPDATE')
      expect(params[0]).toBe(userId)
      expect(params[1]).toBe(JSON.stringify(cfg.widgetSimulation))
    })
  })
})
