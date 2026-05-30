import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Application } from '@ieom/shared'
import { ApplicationRepository } from '../ApplicationRepository.js'

// ── Mock Pool Helpers ────────────────────────────────────────────────────────

function createMockPool() {
  const queryFn = vi.fn()
  const clientQueryFn = vi.fn()
  const releaseFn = vi.fn()
  const client = {
    query: clientQueryFn,
    release: releaseFn,
  }
  const pool = {
    query: queryFn,
    connect: vi.fn().mockResolvedValue(client),
  } as any

  return { pool, queryFn, clientQueryFn, releaseFn, client }
}

function makeApp(overrides: Partial<Application> = {}): Application {
  return {
    id: 'app-1',
    label: 'Test App',
    icon: '🎮',
    appType: 'scene',
    targetSceneId: 'scene-1',
    ...overrides,
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ApplicationRepository', () => {
  let repo: ApplicationRepository
  let mock: ReturnType<typeof createMockPool>
  const userId = 'user-uuid-123'

  beforeEach(() => {
    mock = createMockPool()
    repo = new ApplicationRepository(mock.pool)
  })

  describe('findAll', () => {
    it('queries applications scoped to user_id', async () => {
      mock.queryFn.mockResolvedValue({ rows: [] })

      await repo.findAll(userId)

      expect(mock.queryFn).toHaveBeenCalledWith(
        'SELECT * FROM applications WHERE user_id = $1 ORDER BY id',
        [userId]
      )
    })

    it('returns empty array when no applications exist', async () => {
      mock.queryFn.mockResolvedValue({ rows: [] })

      const result = await repo.findAll(userId)

      expect(result).toEqual([])
    })

    it('maps database rows to Application objects', async () => {
      mock.queryFn.mockResolvedValue({
        rows: [{
          id: 'app-1',
          user_id: userId,
          label: 'My App',
          icon: '🎮',
          app_type: 'scene',
          target_scene_id: 'scene-1',
          widget_source: null,
          widget_component: null,
          icon_position_x: 100,
          icon_position_y: 200,
          icon_size: 'large',
          settings_json: {
            transitionType: 'fade',
            introTransition: 'slide-in',
            exitTransition: 'slide-out',
            introTransitions: [{ type: 'fade', durationMs: 300 }],
            exitTransitions: [{ type: 'fade', durationMs: 200 }],
            launchPipeline: null,
            gallerySettings: null,
            cameraSettings: null,
            sourceWidgetSettings: null,
            stickyNotesSettings: null,
            recycleBinSettings: null,
            themeOverride: null,
          },
        }],
      })

      const result = await repo.findAll(userId)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        id: 'app-1',
        label: 'My App',
        icon: '🎮',
        appType: 'scene',
        targetSceneId: 'scene-1',
        widgetSource: undefined,
        widgetComponent: undefined,
        iconPosition: { x: 100, y: 200 },
        iconSize: 'large',
        transitionType: 'fade',
        introTransition: 'slide-in',
        exitTransition: 'slide-out',
        introTransitions: [{ type: 'fade', durationMs: 300 }],
        exitTransitions: [{ type: 'fade', durationMs: 200 }],
        launchPipeline: null,
        gallerySettings: null,
        cameraSettings: null,
        sourceWidgetSettings: null,
        stickyNotesSettings: null,
        recycleBinSettings: null,
        themeOverride: null,
      })
    })

    it('handles null icon_position fields correctly', async () => {
      mock.queryFn.mockResolvedValue({
        rows: [{
          id: 'app-2',
          user_id: userId,
          label: 'No Position',
          icon: '📦',
          app_type: 'widget',
          target_scene_id: '',
          widget_source: 'system',
          widget_component: 'gallery',
          icon_position_x: null,
          icon_position_y: null,
          icon_size: null,
          settings_json: null,
        }],
      })

      const result = await repo.findAll(userId)

      expect(result[0].iconPosition).toBeUndefined()
      expect(result[0].iconSize).toBeUndefined()
      expect(result[0].widgetSource).toBe('system')
      expect(result[0].widgetComponent).toBe('gallery')
    })
  })

  describe('save', () => {
    it('inserts application with user_id and all fields', async () => {
      mock.queryFn.mockResolvedValue({ rows: [] })

      const app = makeApp({
        iconPosition: { x: 50, y: 75 },
        iconSize: 'normal',
        widgetSource: 'user',
        widgetComponent: 'gallery',
        transitionType: 'fade',
      })

      await repo.save(userId, app)

      expect(mock.queryFn).toHaveBeenCalledTimes(1)
      const [sql, params] = mock.queryFn.mock.calls[0]
      expect(sql).toContain('INSERT INTO applications')
      expect(sql).toContain('ON CONFLICT (user_id, id) DO UPDATE')
      expect(params[0]).toBe('app-1')       // id
      expect(params[1]).toBe(userId)         // user_id
      expect(params[2]).toBe('Test App')     // label
      expect(params[3]).toBe('🎮')           // icon
      expect(params[4]).toBe('scene')        // app_type
      expect(params[5]).toBe('scene-1')      // target_scene_id
      expect(params[6]).toBe('user')         // widget_source
      expect(params[7]).toBe('gallery')      // widget_component
      expect(params[8]).toBe(50)             // icon_position_x
      expect(params[9]).toBe(75)             // icon_position_y
      expect(params[10]).toBe('normal')      // icon_size
      // settings_json is a JSON string containing settings
      const settings = JSON.parse(params[11])
      expect(settings.transitionType).toBe('fade')
    })

    it('sets null for optional fields when not provided', async () => {
      mock.queryFn.mockResolvedValue({ rows: [] })

      const app = makeApp()

      await repo.save(userId, app)

      const params = mock.queryFn.mock.calls[0][1]
      expect(params[6]).toBeNull()   // widget_source
      expect(params[7]).toBeNull()   // widget_component
      expect(params[8]).toBeNull()   // icon_position_x
      expect(params[9]).toBeNull()   // icon_position_y
      expect(params[10]).toBeNull()  // icon_size
    })
  })

  describe('saveAll', () => {
    it('uses a transaction to delete and re-insert all apps', async () => {
      mock.clientQueryFn.mockResolvedValue({ rows: [] })

      const apps = [makeApp({ id: 'app-1' }), makeApp({ id: 'app-2', label: 'Second' })]

      await repo.saveAll(userId, apps)

      const calls = mock.clientQueryFn.mock.calls.map((call) => call[0] as string)
      expect(calls[0]).toBe('BEGIN')
      expect(calls[1]).toContain('DELETE FROM applications WHERE user_id = $1')
      expect(calls[2]).toContain('INSERT INTO applications')
      expect(calls[3]).toContain('INSERT INTO applications')
      expect(calls[4]).toBe('COMMIT')
      expect(mock.releaseFn).toHaveBeenCalled()
    })

    it('scopes DELETE to user_id in saveAll', async () => {
      mock.clientQueryFn.mockResolvedValue({ rows: [] })

      await repo.saveAll(userId, [makeApp()])

      const deleteCall = mock.clientQueryFn.mock.calls[1]
      expect(deleteCall[0]).toContain('DELETE FROM applications WHERE user_id = $1')
      expect(deleteCall[1]).toEqual([userId])
    })

    it('rolls back on error and releases client', async () => {
      mock.clientQueryFn
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // DELETE
        .mockRejectedValueOnce(new Error('insert failed')) // INSERT fails

      await expect(repo.saveAll(userId, [makeApp()])).rejects.toThrow('insert failed')

      const calls = mock.clientQueryFn.mock.calls.map((call) => call[0] as string)
      expect(calls).toContain('ROLLBACK')
      expect(mock.releaseFn).toHaveBeenCalled()
    })

    it('handles empty apps array', async () => {
      mock.clientQueryFn.mockResolvedValue({ rows: [] })

      await repo.saveAll(userId, [])

      const calls = mock.clientQueryFn.mock.calls.map((call) => call[0] as string)
      expect(calls).toEqual(['BEGIN', 'DELETE FROM applications WHERE user_id = $1', 'COMMIT'])
    })
  })

  describe('delete', () => {
    it('deletes application scoped to user_id and app id', async () => {
      mock.queryFn.mockResolvedValue({ rows: [] })

      await repo.delete(userId, 'app-1')

      expect(mock.queryFn).toHaveBeenCalledWith(
        'DELETE FROM applications WHERE user_id = $1 AND id = $2',
        [userId, 'app-1']
      )
    })
  })
})
