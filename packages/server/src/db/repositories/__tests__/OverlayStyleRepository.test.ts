import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OverlayStyleRepository } from '../OverlayStyleRepository.js'

function createMockPool() {
  return {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    connect: vi.fn(),
  }
}

describe('OverlayStyleRepository', () => {
  let repo: OverlayStyleRepository
  let mockPool: ReturnType<typeof createMockPool>

  beforeEach(() => {
    mockPool = createMockPool()
    repo = new OverlayStyleRepository(mockPool as any)
  })

  describe('find', () => {
    it('queries with user_id and returns overlay style', async () => {
      const userId = 'user-style'
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          background_json: { type: 'color', color: '#111' },
          effects_json: { crt: false, noise: true },
          particles_json: { enabled: true, preset: 'snow' },
          font_family: 'monospace',
          accent_color: '#ff00ff',
          text_color: '#000000',
        }],
      })

      const result = await repo.find(userId)

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM overlay_style WHERE user_id = $1'),
        [userId]
      )
      expect(result.background).toEqual({ type: 'color', color: '#111' })
      expect(result.effects).toEqual({ crt: false, noise: true })
      expect(result.particles).toEqual({ enabled: true, preset: 'snow' })
      expect(result.fontFamily).toBe('monospace')
      expect(result.accentColor).toBe('#ff00ff')
      expect(result.textColor).toBe('#000000')
    })

    it('returns defaults when no style exists', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] })
      const result = await repo.find('user-new')
      expect(result.fontFamily).toBe('default')
      expect(result.accentColor).toBe('#00ff41')
      expect(result.textColor).toBe('#ffffff')
    })
  })

  describe('save', () => {
    it('upserts overlay style with user_id', async () => {
      const userId = 'user-save'
      const style = {
        background: { type: 'none' as const, color: '#000', gradient: '', imageUrl: '', videoUrl: '', pattern: 'none' as const, opacity: 0, blur: 0 },
        effects: { crt: true, noise: false, vignette: true, flicker: false, chromatic: false, scanlineOpacity: 0.18, noiseOpacity: 0.06, vignetteStrength: 0.65 },
        particles: { enabled: false, preset: 'none' as const, density: 0.5, speed: 0.4 },
        fontFamily: 'sans-serif',
        accentColor: '#00ff00',
        textColor: '#ffffff',
      }

      await repo.save(userId, style)

      const [sql, params] = mockPool.query.mock.calls[0]
      expect(sql).toContain('INSERT INTO overlay_style')
      expect(sql).toContain('ON CONFLICT (user_id) DO UPDATE')
      expect(params[0]).toBe(userId)
      expect(params[4]).toBe('sans-serif')
      expect(params[5]).toBe('#00ff00')
      expect(params[6]).toBe('#ffffff')
    })
  })
})
