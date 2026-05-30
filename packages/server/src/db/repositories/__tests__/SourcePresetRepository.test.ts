import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SourcePresetRepository } from '../SourcePresetRepository.js'

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

describe('SourcePresetRepository', () => {
  let repo: SourcePresetRepository
  let mockPool: ReturnType<typeof createMockPool>['mockPool']
  let mockClient: ReturnType<typeof createMockPool>['mockClient']

  beforeEach(() => {
    const mocks = createMockPool()
    mockPool = mocks.mockPool
    mockClient = mocks.mockClient
    repo = new SourcePresetRepository(mockPool as any)
  })

  describe('findAll', () => {
    it('queries with user_id and returns presets', async () => {
      const userId = 'user-presets'
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'preset-1',
            user_id: userId,
            label: 'Webcam',
            plugin_type: 'webcam',
            config_json: { resolution: '1080p' },
            default_position_json: { x: 0, y: 0, width: 100, height: 100 },
          },
        ],
      })

      const result = await repo.findAll(userId)

      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM source_presets WHERE user_id = $1 ORDER BY id',
        [userId]
      )
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        id: 'preset-1',
        label: 'Webcam',
        pluginType: 'webcam',
        config: { resolution: '1080p' },
        defaultPosition: { x: 0, y: 0, width: 100, height: 100 },
      })
    })

    it('returns empty array when no presets exist', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] })
      const result = await repo.findAll('user-empty')
      expect(result).toEqual([])
    })
  })

  describe('save', () => {
    it('upserts a preset with user_id', async () => {
      const userId = 'user-save'
      const preset = { id: 'p1', label: 'Camera', pluginType: 'webcam', config: { fps: 30 }, defaultPosition: undefined }

      await repo.save(userId, preset as any)

      const [sql, params] = mockPool.query.mock.calls[0]
      expect(sql).toContain('INSERT INTO source_presets')
      expect(sql).toContain('ON CONFLICT (user_id, id) DO UPDATE')
      expect(params[0]).toBe('p1')
      expect(params[1]).toBe(userId)
      expect(params[5]).toBeNull() // defaultPosition null
    })
  })

  describe('saveAll', () => {
    it('replaces all presets for user in a transaction', async () => {
      const userId = 'user-bulk'
      const presets = [
        { id: 'p1', label: 'P1', pluginType: 'webcam', config: {}, defaultPosition: undefined },
      ]

      await repo.saveAll(userId, presets as any)

      expect(mockPool.connect).toHaveBeenCalledTimes(1)
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN')
      expect(mockClient.query).toHaveBeenCalledWith(
        'DELETE FROM source_presets WHERE user_id = $1',
        [userId]
      )
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT')
      expect(mockClient.release).toHaveBeenCalled()
    })

    it('rolls back on error', async () => {
      mockClient.query.mockImplementation((sql: string) => {
        if (sql === 'BEGIN') return Promise.resolve()
        if (sql.includes('DELETE')) return Promise.reject(new Error('DB error'))
        return Promise.resolve()
      })

      await expect(repo.saveAll('user-fail', [])).rejects.toThrow('DB error')
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK')
      expect(mockClient.release).toHaveBeenCalled()
    })
  })

  describe('delete', () => {
    it('deletes a preset scoped to user_id', async () => {
      await repo.delete('user-del', 'preset-1')
      expect(mockPool.query).toHaveBeenCalledWith(
        'DELETE FROM source_presets WHERE user_id = $1 AND id = $2',
        ['user-del', 'preset-1']
      )
    })
  })
})
