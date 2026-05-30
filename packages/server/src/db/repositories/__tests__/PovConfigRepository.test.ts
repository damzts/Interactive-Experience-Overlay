import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PovConfigRepository } from '../povConfigRepo.js'

function createMockPool() {
  return {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    connect: vi.fn(),
  }
}

describe('PovConfigRepository', () => {
  let repo: PovConfigRepository
  let mockPool: ReturnType<typeof createMockPool>

  beforeEach(() => {
    mockPool = createMockPool()
    repo = new PovConfigRepository(mockPool as any)
  })

  describe('getPovConfig', () => {
    it('queries with user_id and returns config', async () => {
      const userId = 'user-pov'
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          poll_interval_ms: 200,
          rolling_window_ms: 3000,
          cooldown_ms: 5000,
          activity_threshold: 0.2,
          silence_threshold: 0.1,
          health_check_interval_ms: 15000,
          max_connections: 8,
          transition_type: 'fade',
          transition_duration_ms: 500,
          score_emit_interval_ms: 1000,
          db_floor: -80,
          db_ceiling: -10,
        }],
      })

      const result = await repo.getPovConfig(userId)

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM pov_config WHERE user_id = $1'),
        [userId]
      )
      expect(result.pollIntervalMs).toBe(200)
      expect(result.transition.type).toBe('fade')
      expect(result.transition.durationMs).toBe(500)
    })

    it('returns defaults when no config exists', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] })
      const result = await repo.getPovConfig('user-new')
      expect(result.pollIntervalMs).toBe(100)
      expect(result.transition.type).toBe('cut')
    })
  })

  describe('upsertPovConfig', () => {
    it('upserts config with user_id and returns validated config', async () => {
      const userId = 'user-upsert'
      const config = { pollIntervalMs: 150, cooldownMs: 2000 }

      const result = await repo.upsertPovConfig(userId, config)

      const [sql, params] = mockPool.query.mock.calls[0]
      expect(sql).toContain('INSERT INTO pov_config')
      expect(sql).toContain('ON CONFLICT (user_id) DO UPDATE')
      expect(params[0]).toBe(userId)
      expect(result.pollIntervalMs).toBe(150)
      expect(result.cooldownMs).toBe(2000)
    })
  })
})
