import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AudioConfigRepository } from '../AudioConfigRepository.js'

function createMockPool() {
  return {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    connect: vi.fn(),
  }
}

describe('AudioConfigRepository', () => {
  let repo: AudioConfigRepository
  let mockPool: ReturnType<typeof createMockPool>

  beforeEach(() => {
    mockPool = createMockPool()
    repo = new AudioConfigRepository(mockPool as any)
  })

  describe('find', () => {
    it('queries with user_id and returns audio config', async () => {
      const userId = 'user-audio'
      mockPool.query.mockResolvedValueOnce({
        rows: [{ master_volume: 0.9, sfx_volume: 0.6, music_volume: 0.3 }],
      })

      const result = await repo.find(userId)

      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT master_volume, sfx_volume, music_volume FROM audio_config WHERE user_id = $1',
        [userId]
      )
      expect(result).toEqual({ masterVolume: 0.9, sfxVolume: 0.6, musicVolume: 0.3 })
    })

    it('returns defaults when no config exists', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] })
      const result = await repo.find('user-new')
      expect(result).toEqual({ masterVolume: 0.8, sfxVolume: 0.7, musicVolume: 0.4 })
    })
  })

  describe('save', () => {
    it('upserts audio config with user_id', async () => {
      const userId = 'user-save'
      const cfg = { masterVolume: 1.0, sfxVolume: 0.5, musicVolume: 0.2 }

      await repo.save(userId, cfg)

      const [sql, params] = mockPool.query.mock.calls[0]
      expect(sql).toContain('INSERT INTO audio_config')
      expect(sql).toContain('ON CONFLICT (user_id) DO UPDATE')
      expect(params).toEqual([userId, 1.0, 0.5, 0.2])
    })
  })
})
