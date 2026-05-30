import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SceneRepository } from '../SceneRepository.js'
import type { Scene } from '@ieom/shared'

// Mock pool and client helpers
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

function makeScene(overrides: Partial<Scene> = {}): Scene {
  return {
    id: 'scene-1',
    label: 'Test Scene',
    backgroundOpaque: false,
    sources: [],
    ...overrides,
  }
}

describe('SceneRepository', () => {
  let repo: SceneRepository
  let mockPool: ReturnType<typeof createMockPool>['mockPool']
  let mockClient: ReturnType<typeof createMockPool>['mockClient']

  beforeEach(() => {
    const mocks = createMockPool()
    mockPool = mocks.mockPool
    mockClient = mocks.mockClient
    repo = new SceneRepository(mockPool as any)
  })

  describe('findAll', () => {
    it('queries with user_id filter and returns scenes keyed by id', async () => {
      const userId = 'user-abc-123'
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'scene-1',
            user_id: userId,
            label: 'Main',
            background_opaque: true,
            sources_json: [{ type: 'image', url: 'test.png' }],
            style_json: null,
            lobby_config_json: null,
            transitions_json: { introTransition: 'fade', exitTransition: 'slide' },
          },
          {
            id: 'scene-2',
            user_id: userId,
            label: 'Lobby',
            background_opaque: false,
            sources_json: [],
            style_json: { background: '#000' },
            lobby_config_json: { enabled: true },
            transitions_json: null,
          },
        ],
      })

      const result = await repo.findAll(userId)

      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM scenes WHERE user_id = $1',
        [userId]
      )
      expect(Object.keys(result)).toEqual(['scene-1', 'scene-2'])
      expect(result['scene-1']).toEqual({
        id: 'scene-1',
        label: 'Main',
        backgroundOpaque: true,
        sources: [{ type: 'image', url: 'test.png' }],
        style: undefined,
        lobbyConfig: undefined,
        introTransition: 'fade',
        exitTransition: 'slide',
        introTransitions: undefined,
        exitTransitions: undefined,
        musicTrack: undefined,
      })
      expect(result['scene-2'].style).toEqual({ background: '#000' })
      expect(result['scene-2'].lobbyConfig).toEqual({ enabled: true })
    })

    it('returns empty object when no scenes exist for user', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] })

      const result = await repo.findAll('user-no-scenes')

      expect(result).toEqual({})
    })
  })

  describe('save', () => {
    it('inserts a scene with user_id using parameterized query', async () => {
      const userId = 'user-xyz'
      const scene = makeScene({
        id: 'new-scene',
        label: 'New Scene',
        backgroundOpaque: true,
        sources: [{ type: 'webcam' } as any],
        style: { background: '#fff' } as any,
        lobbyConfig: { enabled: false } as any,
        introTransition: 'fade',
        exitTransition: 'slide',
        introTransitions: [{ type: 'fade', duration: 500 }] as any,
        exitTransitions: [{ type: 'slide', duration: 300 }] as any,
        musicTrack: 'track.mp3',
      })

      await repo.save(userId, scene)

      expect(mockPool.query).toHaveBeenCalledTimes(1)
      const [sql, params] = mockPool.query.mock.calls[0]
      expect(sql).toContain('INSERT INTO scenes')
      expect(sql).toContain('ON CONFLICT (user_id, id) DO UPDATE')
      expect(params[0]).toBe('new-scene') // id
      expect(params[1]).toBe(userId) // user_id
      expect(params[2]).toBe('New Scene') // label
      expect(params[3]).toBe(true) // background_opaque
      expect(JSON.parse(params[4])).toEqual([{ type: 'webcam' }]) // sources_json
      expect(JSON.parse(params[5])).toEqual({ background: '#fff' }) // style_json
      expect(JSON.parse(params[6])).toEqual({ enabled: false }) // lobby_config_json
      const transitions = JSON.parse(params[7])
      expect(transitions.introTransition).toBe('fade')
      expect(transitions.exitTransition).toBe('slide')
      expect(transitions.musicTrack).toBe('track.mp3')
    })

    it('sets style_json and lobby_config_json to null when not provided', async () => {
      const scene = makeScene({ style: undefined, lobbyConfig: undefined })

      await repo.save('user-1', scene)

      const params = mockPool.query.mock.calls[0][1]
      expect(params[5]).toBeNull() // style_json
      expect(params[6]).toBeNull() // lobby_config_json
    })
  })

  describe('saveAll', () => {
    it('deletes existing scenes for user and inserts all new ones in a transaction', async () => {
      const userId = 'user-bulk'
      const scenes: Record<string, Scene> = {
        's1': makeScene({ id: 's1', label: 'Scene 1' }),
        's2': makeScene({ id: 's2', label: 'Scene 2' }),
      }

      await repo.saveAll(userId, scenes)

      // Should use a client transaction
      expect(mockPool.connect).toHaveBeenCalledTimes(1)
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN')

      // Delete existing scenes for this user
      expect(mockClient.query).toHaveBeenCalledWith(
        'DELETE FROM scenes WHERE user_id = $1',
        [userId]
      )

      // Insert each scene (2 scenes)
      const insertCalls = mockClient.query.mock.calls.filter(
        (call: any[]) => typeof call[0] === 'string' && call[0].includes('INSERT INTO scenes')
      )
      expect(insertCalls).toHaveLength(2)

      // Verify user_id is set on inserts
      for (const call of insertCalls) {
        expect(call[1][1]).toBe(userId)
      }

      expect(mockClient.query).toHaveBeenCalledWith('COMMIT')
      expect(mockClient.release).toHaveBeenCalled()
    })

    it('rolls back and releases client on error', async () => {
      const userId = 'user-fail'
      mockClient.query.mockImplementation((sql: string) => {
        if (sql === 'BEGIN') return Promise.resolve()
        if (sql.includes('DELETE')) return Promise.reject(new Error('DB error'))
        return Promise.resolve()
      })

      await expect(repo.saveAll(userId, { s1: makeScene() })).rejects.toThrow('DB error')

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK')
      expect(mockClient.release).toHaveBeenCalled()
    })

    it('handles empty scenes record by only deleting', async () => {
      const userId = 'user-empty'

      await repo.saveAll(userId, {})

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN')
      expect(mockClient.query).toHaveBeenCalledWith(
        'DELETE FROM scenes WHERE user_id = $1',
        [userId]
      )
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT')

      // No INSERT calls
      const insertCalls = mockClient.query.mock.calls.filter(
        (call: any[]) => typeof call[0] === 'string' && call[0].includes('INSERT')
      )
      expect(insertCalls).toHaveLength(0)
    })
  })

  describe('delete', () => {
    it('deletes a scene scoped to user_id', async () => {
      const userId = 'user-del'
      const sceneId = 'scene-to-delete'

      await repo.delete(userId, sceneId)

      expect(mockPool.query).toHaveBeenCalledWith(
        'DELETE FROM scenes WHERE user_id = $1 AND id = $2',
        [userId, sceneId]
      )
    })
  })

  describe('tenant isolation', () => {
    it('findAll only returns scenes for the specified user', async () => {
      const userA = 'user-a'
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'scene-a',
            user_id: userA,
            label: 'User A Scene',
            background_opaque: false,
            sources_json: [],
            style_json: null,
            lobby_config_json: null,
            transitions_json: null,
          },
        ],
      })

      const result = await repo.findAll(userA)

      // Verify the query uses user_id parameter
      expect(mockPool.query.mock.calls[0][1]).toEqual([userA])
      expect(Object.keys(result)).toEqual(['scene-a'])
    })

    it('delete only affects the specified user scene', async () => {
      await repo.delete('user-a', 'shared-scene-id')

      const [sql, params] = mockPool.query.mock.calls[0]
      expect(sql).toContain('WHERE user_id = $1 AND id = $2')
      expect(params).toEqual(['user-a', 'shared-scene-id'])
    })
  })
})
