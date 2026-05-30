import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OnlineConfigRepository } from '../onlineConfigRepo.js'

function createMockPool() {
  return {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    connect: vi.fn(),
  }
}

describe('OnlineConfigRepository', () => {
  let repo: OnlineConfigRepository
  let mockPool: ReturnType<typeof createMockPool>

  beforeEach(() => {
    mockPool = createMockPool()
    repo = new OnlineConfigRepository(mockPool as any)
  })

  describe('getOnlineConfig', () => {
    it('queries with user_id and returns config', async () => {
      const userId = 'user-online'
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          audio_report_interval_ms: 200,
          rolling_window_ms: 3000,
          cooldown_ms: 5000,
          activity_threshold: 0.2,
          silence_threshold: 0.1,
          max_players_per_room: 8,
          max_active_rooms: 5,
          score_emit_interval_ms: 1000,
          idle_timeout_ms: 60000,
          transition_type: 'fade',
          transition_duration_ms: 500,
        }],
      })

      const result = await repo.getOnlineConfig(userId)

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM online_config WHERE user_id = $1'),
        [userId]
      )
      expect(result.audioReportIntervalMs).toBe(200)
      expect(result.transition.type).toBe('fade')
      expect(result.transition.durationMs).toBe(500)
    })

    it('returns defaults when no config exists', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] })
      const result = await repo.getOnlineConfig('user-new')
      expect(result.transition.type).toBe('cut')
    })
  })

  describe('upsertOnlineConfig', () => {
    it('upserts config with user_id and returns validated config', async () => {
      const userId = 'user-upsert'
      const config = { audioReportIntervalMs: 300, cooldownMs: 4000 }

      const result = await repo.upsertOnlineConfig(userId, config)

      const [sql, params] = mockPool.query.mock.calls[0]
      expect(sql).toContain('INSERT INTO online_config')
      expect(sql).toContain('ON CONFLICT (user_id) DO UPDATE')
      expect(params[0]).toBe(userId)
      expect(result.audioReportIntervalMs).toBe(300)
      expect(result.cooldownMs).toBe(4000)
    })
  })
})
