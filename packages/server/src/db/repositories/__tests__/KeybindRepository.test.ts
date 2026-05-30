import { describe, it, expect, vi, beforeEach } from 'vitest'
import { KeybindRepository } from '../KeybindRepository.js'

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

describe('KeybindRepository', () => {
  let repo: KeybindRepository
  let mockPool: ReturnType<typeof createMockPool>['mockPool']
  let mockClient: ReturnType<typeof createMockPool>['mockClient']

  beforeEach(() => {
    const mocks = createMockPool()
    mockPool = mocks.mockPool
    mockClient = mocks.mockClient
    repo = new KeybindRepository(mockPool as any)
  })

  describe('find', () => {
    it('queries with user_id and returns keybinds grouped by scope', async () => {
      const userId = 'user-kb'
      mockPool.query.mockResolvedValueOnce({
        rows: [
          { scope: 'obs', key: 'ctrl+1', action: 'switchScene' },
          { scope: 'admin', key: 'ctrl+s', action: 'save' },
          { scope: 'obs', key: 'ctrl+2', action: 'mute' },
        ],
      })

      const result = await repo.find(userId)

      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT scope, key, action FROM keybinds WHERE user_id = $1',
        [userId]
      )
      expect(result.obs).toEqual({ 'ctrl+1': 'switchScene', 'ctrl+2': 'mute' })
      expect(result.admin).toEqual({ 'ctrl+s': 'save' })
    })

    it('returns empty keybinds when none exist', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] })
      const result = await repo.find('user-empty')
      expect(result).toEqual({ obs: {}, admin: {} })
    })
  })

  describe('save', () => {
    it('replaces all keybinds for user in a transaction', async () => {
      const userId = 'user-save'
      const keybinds = {
        obs: { 'ctrl+1': 'scene1' },
        admin: { 'ctrl+s': 'save' },
      }

      await repo.save(userId, keybinds)

      expect(mockPool.connect).toHaveBeenCalledTimes(1)
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN')
      expect(mockClient.query).toHaveBeenCalledWith(
        'DELETE FROM keybinds WHERE user_id = $1',
        [userId]
      )

      // Check inserts
      const insertCalls = mockClient.query.mock.calls.filter(
        (call: any[]) => typeof call[0] === 'string' && call[0].includes('INSERT INTO keybinds')
      )
      expect(insertCalls).toHaveLength(2)
      expect(insertCalls[0][1]).toEqual([userId, 'obs', 'ctrl+1', 'scene1'])
      expect(insertCalls[1][1]).toEqual([userId, 'admin', 'ctrl+s', 'save'])

      expect(mockClient.query).toHaveBeenCalledWith('COMMIT')
      expect(mockClient.release).toHaveBeenCalled()
    })

    it('rolls back on error', async () => {
      mockClient.query.mockImplementation((sql: string) => {
        if (sql === 'BEGIN') return Promise.resolve()
        if (sql.includes('DELETE')) return Promise.reject(new Error('DB error'))
        return Promise.resolve()
      })

      await expect(repo.save('user-fail', { obs: {}, admin: {} })).rejects.toThrow('DB error')
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK')
      expect(mockClient.release).toHaveBeenCalled()
    })
  })
})
