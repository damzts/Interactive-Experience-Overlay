import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventRepository } from '../EventRepository.js'

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

describe('EventRepository', () => {
  let repo: EventRepository
  let mockPool: ReturnType<typeof createMockPool>['mockPool']
  let mockClient: ReturnType<typeof createMockPool>['mockClient']

  beforeEach(() => {
    const mocks = createMockPool()
    mockPool = mocks.mockPool
    mockClient = mocks.mockClient
    repo = new EventRepository(mockPool as any)
  })

  describe('findAll', () => {
    it('queries with user_id filter and returns events', async () => {
      const userId = 'user-abc'
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'evt-1',
            user_id: userId,
            label: 'Test Event',
            icon: '🎉',
            color: '#ff0000',
            desc: 'A test event',
            effects_json: [{ type: 'sound', url: 'boom.mp3' }],
            actions_json: null,
            auto_json: { enabled: false, mode: 'interval', intervalMin: 60, idleMin: 5, chance: 1, cooldownMin: 0 },
          },
        ],
      })

      const result = await repo.findAll(userId)

      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM events WHERE user_id = $1 ORDER BY id',
        [userId]
      )
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('evt-1')
      expect(result[0].label).toBe('Test Event')
      expect(result[0].effects).toEqual([{ type: 'sound', url: 'boom.mp3' }])
    })

    it('returns empty array when no events exist', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] })
      const result = await repo.findAll('user-empty')
      expect(result).toEqual([])
    })
  })

  describe('save', () => {
    it('upserts an event with user_id scoping', async () => {
      const userId = 'user-xyz'
      const event = {
        id: 'evt-1',
        label: 'New Event',
        icon: '⚡',
        color: '#00ff00',
        desc: 'Description',
        effects: [{ type: 'flash' }],
        actions: { click: 'doSomething' },
        auto: { enabled: true, mode: 'interval' as const, intervalMin: 30, idleMin: 5, chance: 0.5, cooldownMin: 10 },
      }

      await repo.save(userId, event as any)

      expect(mockPool.query).toHaveBeenCalledTimes(1)
      const [sql, params] = mockPool.query.mock.calls[0]
      expect(sql).toContain('INSERT INTO events')
      expect(sql).toContain('ON CONFLICT (user_id, id) DO UPDATE')
      expect(params[0]).toBe('evt-1')
      expect(params[1]).toBe(userId)
      expect(params[2]).toBe('New Event')
    })
  })

  describe('saveAll', () => {
    it('replaces all events for user in a transaction', async () => {
      const userId = 'user-bulk'
      const events = [
        { id: 'e1', label: 'E1', icon: '🔥', color: '#f00', desc: '', effects: [], actions: undefined, auto: { enabled: false, mode: 'interval' as const, intervalMin: 60, idleMin: 5, chance: 1, cooldownMin: 0 } },
      ]

      await repo.saveAll(userId, events as any)

      expect(mockPool.connect).toHaveBeenCalledTimes(1)
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN')
      expect(mockClient.query).toHaveBeenCalledWith(
        'DELETE FROM events WHERE user_id = $1',
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
    it('deletes an event scoped to user_id', async () => {
      await repo.delete('user-del', 'evt-1')
      expect(mockPool.query).toHaveBeenCalledWith(
        'DELETE FROM events WHERE user_id = $1 AND id = $2',
        ['user-del', 'evt-1']
      )
    })
  })
})
