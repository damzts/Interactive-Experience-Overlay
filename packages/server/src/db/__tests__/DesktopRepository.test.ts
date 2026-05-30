import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DesktopRepository } from '../repositories/DesktopRepository.js'
import type { DesktopConfig, WidgetLayoutDefinition } from '@ieom/shared'

describe('DesktopRepository', () => {
  let mockPool: {
    query: ReturnType<typeof vi.fn>
    connect: ReturnType<typeof vi.fn>
  }
  let mockClient: {
    query: ReturnType<typeof vi.fn>
    release: ReturnType<typeof vi.fn>
  }
  let repo: DesktopRepository

  const userId = '123e4567-e89b-12d3-a456-426614174000'

  const mockDesktopRow = {
    user_id: userId,
    global_theme_json: { theme: 'win98', widgetTheme: null, appearance: 'light' },
    icon_animation: 'bounce',
    icon_arrangement: 'grid',
    icon_motion: 1.0,
    icon_arrangement_motion: 0.5,
    default_icon_size: 'normal',
    auto_arrange_icons: true,
    recycle_bin_json: { fullOnStart: false },
    screen_saver_json: { enabled: true, timeoutMinutes: 5, preset: 'starfield' },
    system_sounds_json: { startup: 'start.wav', error: 'err.wav', notify: 'notify.wav', click: 'click.wav', close: 'close.wav' },
    widget_positions_json: { music: { x: 100, y: 200 } },
    widget_sizes_json: null,
    widget_z_indices_json: { music: 10 },
    widget_default_z_indices_json: { music: 5 },
  }

  const mockWidgetLayoutRows = [
    {
      id: 'layout-1',
      label: 'Default Layout',
      icon: 'grid-icon',
      source: 'user' as const,
      description: 'My default layout',
      items_json: [{ widgetId: 'music', position: { x: 0, y: 0 } }],
      default_config_json: null,
    },
  ]

  beforeEach(() => {
    mockClient = {
      query: vi.fn(),
      release: vi.fn(),
    }
    mockPool = {
      query: vi.fn(),
      connect: vi.fn().mockResolvedValue(mockClient),
    }
    repo = new DesktopRepository(mockPool as any)
  })

  describe('find', () => {
    it('returns undefined when no row exists for user', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] })

      const result = await repo.find(userId)
      expect(result).toBeUndefined()
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM desktop_config WHERE user_id = $1',
        [userId]
      )
    })

    it('returns DesktopConfig with defaults applied when row exists', async () => {
      // First query: desktop_config
      mockPool.query
        .mockResolvedValueOnce({ rows: [mockDesktopRow] })
        // Second query: widget_layouts
        .mockResolvedValueOnce({ rows: mockWidgetLayoutRows })

      const result = await repo.find(userId)
      expect(result).toBeDefined()
      expect(result!.iconAnimation).toBe('bounce')
      expect(result!.iconArrangement).toBe('grid')
      expect(result!.iconMotion).toBe(1.0)
      expect(result!.autoArrangeIcons).toBe(true)
      expect(result!.defaultIconSize).toBe('normal')
      expect(result!.widgetPositions).toEqual({ music: { x: 100, y: 200 } })
      expect(result!.widgetZIndices).toEqual({ music: 10 })
    })

    it('loads widget layouts scoped to user_id', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [mockDesktopRow] })
        .mockResolvedValueOnce({ rows: mockWidgetLayoutRows })

      const result = await repo.find(userId)
      // withDesktopConfigDefaults may add system layouts, but our user layout should be present
      const userLayout = result!.widgetLayouts!.find(l => l.id === 'layout-1')
      expect(userLayout).toBeDefined()
      expect(userLayout!.label).toBe('Default Layout')
      expect(userLayout!.description).toBe('My default layout')

      // Verify widget_layouts query is scoped to user_id
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT id, label, icon, source, description, items_json, default_config_json FROM widget_layouts WHERE user_id = $1 ORDER BY id',
        [userId]
      )
    })

    it('handles null JSONB fields gracefully', async () => {
      const rowWithNulls = {
        ...mockDesktopRow,
        global_theme_json: null,
        widget_positions_json: null,
        widget_sizes_json: null,
        widget_z_indices_json: null,
        widget_default_z_indices_json: null,
      }
      mockPool.query
        .mockResolvedValueOnce({ rows: [rowWithNulls] })
        .mockResolvedValueOnce({ rows: [] })

      const result = await repo.find(userId)
      expect(result).toBeDefined()
      // withDesktopConfigDefaults fills in defaults including system widget layouts
      expect(result!.widgetLayouts).toBeDefined()
      expect(Array.isArray(result!.widgetLayouts)).toBe(true)
    })

    it('does not return data for a different user_id', async () => {
      const otherUserId = '999e4567-e89b-12d3-a456-426614174999'
      mockPool.query.mockResolvedValueOnce({ rows: [] })

      const result = await repo.find(otherUserId)
      expect(result).toBeUndefined()
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM desktop_config WHERE user_id = $1',
        [otherUserId]
      )
    })
  })

  describe('save', () => {
    const sampleConfig: DesktopConfig = {
      globalThemeDefault: { theme: 'win98', widgetTheme: null, appearance: 'light' },
      iconAnimation: 'bounce',
      iconArrangement: 'grid',
      iconMotion: 1.0,
      iconArrangementMotion: 0.5,
      defaultIconSize: 'normal',
      autoArrangeIcons: true,
      recycleBin: { fullOnStart: false },
      screenSaver: { enabled: true, timeoutMinutes: 5, preset: 'starfield' },
      systemSounds: { startup: 'start.wav', error: 'err.wav', notify: 'notify.wav', click: 'click.wav', close: 'close.wav' },
      widgetPositions: { music: { x: 100, y: 200 } },
      widgetSizes: undefined,
      widgetZIndices: { music: 10 },
      widgetDefaultZIndices: { music: 5 },
      widgetLayouts: [
        {
          id: 'layout-1',
          label: 'Default',
          icon: 'grid',
          source: 'user' as const,
          items: [],
        },
      ],
    }

    it('uses a transaction for save operations', async () => {
      mockClient.query.mockResolvedValue({ rows: [] })

      await repo.save(userId, sampleConfig)

      const calls = mockClient.query.mock.calls.map((c: any[]) => c[0])
      expect(calls[0]).toBe('BEGIN')
      expect(calls[calls.length - 1]).toBe('COMMIT')
    })

    it('performs INSERT ON CONFLICT upsert with user_id as PK', async () => {
      mockClient.query.mockResolvedValue({ rows: [] })

      await repo.save(userId, sampleConfig)

      // Second call is the desktop_config upsert (after BEGIN)
      const upsertCall = mockClient.query.mock.calls[1]
      expect(upsertCall[0]).toContain('INSERT INTO desktop_config')
      expect(upsertCall[0]).toContain('ON CONFLICT (user_id) DO UPDATE')
      // First param is userId
      expect(upsertCall[1][0]).toBe(userId)
    })

    it('serializes JSONB fields as JSON strings', async () => {
      mockClient.query.mockResolvedValue({ rows: [] })

      await repo.save(userId, sampleConfig)

      const upsertParams = mockClient.query.mock.calls[1][1]
      // globalThemeDefault is serialized
      expect(upsertParams[1]).toBe(JSON.stringify(sampleConfig.globalThemeDefault))
      // recycleBin is serialized
      expect(upsertParams[8]).toBe(JSON.stringify(sampleConfig.recycleBin))
      // screenSaver is serialized
      expect(upsertParams[9]).toBe(JSON.stringify(sampleConfig.screenSaver))
      // systemSounds is serialized
      expect(upsertParams[10]).toBe(JSON.stringify(sampleConfig.systemSounds))
    })

    it('passes null for undefined optional JSONB fields', async () => {
      mockClient.query.mockResolvedValue({ rows: [] })

      const configWithNulls = { ...sampleConfig, widgetSizes: undefined, widgetPositions: undefined }
      await repo.save(userId, configWithNulls)

      const upsertParams = mockClient.query.mock.calls[1][1]
      // widgetPositions (index 11) should be null
      expect(upsertParams[11]).toBeNull()
      // widgetSizes (index 12) should be null
      expect(upsertParams[12]).toBeNull()
    })

    it('saves widget layouts scoped to user_id', async () => {
      mockClient.query.mockResolvedValue({ rows: [] })

      await repo.save(userId, sampleConfig)

      // After BEGIN and desktop_config upsert, there should be a DELETE for widget_layouts
      const deleteCall = mockClient.query.mock.calls[2]
      expect(deleteCall[0]).toBe('DELETE FROM widget_layouts WHERE user_id = $1')
      expect(deleteCall[1]).toEqual([userId])

      // Then INSERT for each layout
      const insertCall = mockClient.query.mock.calls[3]
      expect(insertCall[0]).toContain('INSERT INTO widget_layouts')
      expect(insertCall[1][0]).toBe('layout-1') // id
      expect(insertCall[1][1]).toBe(userId) // user_id
      expect(insertCall[1][2]).toBe('Default') // label
    })

    it('rolls back transaction on error', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockRejectedValueOnce(new Error('DB error')) // INSERT fails

      await expect(repo.save(userId, sampleConfig)).rejects.toThrow('DB error')

      const calls = mockClient.query.mock.calls.map((c: any[]) => c[0])
      expect(calls).toContain('ROLLBACK')
    })

    it('releases client after successful save', async () => {
      mockClient.query.mockResolvedValue({ rows: [] })

      await repo.save(userId, sampleConfig)

      expect(mockClient.release).toHaveBeenCalled()
    })

    it('releases client after failed save', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockRejectedValueOnce(new Error('DB error'))

      await expect(repo.save(userId, sampleConfig)).rejects.toThrow()

      expect(mockClient.release).toHaveBeenCalled()
    })

    it('handles empty widgetLayouts array', async () => {
      mockClient.query.mockResolvedValue({ rows: [] })

      const configNoLayouts = { ...sampleConfig, widgetLayouts: [] }
      await repo.save(userId, configNoLayouts)

      // Should still DELETE existing layouts but not INSERT any
      const deleteCall = mockClient.query.mock.calls[2]
      expect(deleteCall[0]).toBe('DELETE FROM widget_layouts WHERE user_id = $1')
      // No more calls after DELETE + COMMIT
      expect(mockClient.query.mock.calls[3][0]).toBe('COMMIT')
    })

    it('handles undefined widgetLayouts', async () => {
      mockClient.query.mockResolvedValue({ rows: [] })

      const configUndefinedLayouts = { ...sampleConfig, widgetLayouts: undefined }
      await repo.save(userId, configUndefinedLayouts)

      // Should DELETE existing layouts (treating undefined as empty)
      const deleteCall = mockClient.query.mock.calls[2]
      expect(deleteCall[0]).toBe('DELETE FROM widget_layouts WHERE user_id = $1')
      expect(mockClient.query.mock.calls[3][0]).toBe('COMMIT')
    })
  })
})
