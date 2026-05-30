import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DEFAULT_CONFIG } from '@ieom/shared'
import type { AppConfig } from '@ieom/shared'
import { ConfigService } from '../ConfigService.js'
import type { TenantRepositories } from '../../db/repositories/index.js'

// ── Mock Repositories ────────────────────────────────────────────

function createMockRepos(): TenantRepositories {
  return {
    scene: {
      findAll: vi.fn().mockResolvedValue(structuredClone(DEFAULT_CONFIG.scenes)),
      save: vi.fn().mockResolvedValue(undefined),
      saveAll: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      pool: {
        connect: vi.fn().mockResolvedValue({
          query: vi.fn().mockResolvedValue({ rows: [] }),
          release: vi.fn(),
        }),
      },
    } as any,
    application: {
      findAll: vi.fn().mockResolvedValue(structuredClone(DEFAULT_CONFIG.applications)),
      save: vi.fn().mockResolvedValue(undefined),
      saveAll: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    } as any,
    desktop: {
      find: vi.fn().mockResolvedValue(structuredClone(DEFAULT_CONFIG.desktopConfig)),
      save: vi.fn().mockResolvedValue(undefined),
    } as any,
    event: {
      findAll: vi.fn().mockResolvedValue(structuredClone(DEFAULT_CONFIG.events ?? [])),
      save: vi.fn().mockResolvedValue(undefined),
      saveAll: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    } as any,
    keybind: {
      find: vi.fn().mockResolvedValue(structuredClone(DEFAULT_CONFIG.keybinds)),
      save: vi.fn().mockResolvedValue(undefined),
    } as any,
    obsConfig: {
      find: vi.fn().mockResolvedValue(structuredClone(DEFAULT_CONFIG.obs)),
      save: vi.fn().mockResolvedValue(undefined),
    } as any,
    audioConfig: {
      find: vi.fn().mockResolvedValue(structuredClone(DEFAULT_CONFIG.audio)),
      save: vi.fn().mockResolvedValue(undefined),
    } as any,
    overlayStyle: {
      find: vi.fn().mockResolvedValue(structuredClone(DEFAULT_CONFIG.overlayStyle)),
      save: vi.fn().mockResolvedValue(undefined),
    } as any,
    ambiance: {
      find: vi.fn().mockResolvedValue(structuredClone(DEFAULT_CONFIG.desktopAmbiance)),
      save: vi.fn().mockResolvedValue(undefined),
    } as any,
    sourcePreset: {
      findAll: vi.fn().mockResolvedValue(structuredClone(DEFAULT_CONFIG.sourcePresets ?? [])),
      save: vi.fn().mockResolvedValue(undefined),
      saveAll: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    } as any,
    media: {
      findAll: vi.fn().mockResolvedValue(structuredClone(DEFAULT_CONFIG.mediaLibrary ?? [])),
      save: vi.fn().mockResolvedValue(undefined),
      saveAll: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    } as any,
    povConfig: {
      getPovConfig: vi.fn().mockResolvedValue({ pollIntervalMs: 100, rollingWindowMs: 2000, cooldownMs: 3000, activityThreshold: 0.15, silenceThreshold: 0.05, healthCheckIntervalMs: 10000, maxConnections: 10, transition: { type: 'cut', durationMs: 0 }, scoreEmitIntervalMs: 500, dbFloor: -60, dbCeiling: 0 }),
      upsertPovConfig: vi.fn().mockResolvedValue({ pollIntervalMs: 100, rollingWindowMs: 2000, cooldownMs: 3000, activityThreshold: 0.15, silenceThreshold: 0.05, healthCheckIntervalMs: 10000, maxConnections: 10, transition: { type: 'cut', durationMs: 0 }, scoreEmitIntervalMs: 500, dbFloor: -60, dbCeiling: 0 }),
    } as any,
    povFeeds: {
      getAllFeeds: vi.fn().mockResolvedValue([]),
      getFeedById: vi.fn().mockResolvedValue(undefined),
      insertFeed: vi.fn().mockResolvedValue(undefined),
      updateFeed: vi.fn().mockResolvedValue(undefined),
      deleteFeed: vi.fn().mockResolvedValue(undefined),
    } as any,
    onlineConfig: {
      getOnlineConfig: vi.fn().mockResolvedValue({ audioReportIntervalMs: 250, rollingWindowMs: 2000, cooldownMs: 3000, activityThreshold: 0.15, silenceThreshold: 0.05, maxPlayersPerRoom: 8, maxActiveRooms: 5, scoreEmitIntervalMs: 500, idleTimeoutMs: 300000, transition: { type: 'cut', durationMs: 0 } }),
      upsertOnlineConfig: vi.fn().mockResolvedValue({ audioReportIntervalMs: 250, rollingWindowMs: 2000, cooldownMs: 3000, activityThreshold: 0.15, silenceThreshold: 0.05, maxPlayersPerRoom: 8, maxActiveRooms: 5, scoreEmitIntervalMs: 500, idleTimeoutMs: 300000, transition: { type: 'cut', durationMs: 0 } }),
    } as any,
  }
}

function createMockIo() {
  const emitFn = vi.fn()
  const toFn = vi.fn().mockReturnValue({ emit: emitFn })
  return { to: toFn, emit: emitFn, _toFn: toFn, _emitFn: emitFn }
}

// ── Tests ────────────────────────────────────────────────────────

describe('ConfigService', () => {
  let repos: TenantRepositories
  let service: ConfigService

  beforeEach(() => {
    vi.useFakeTimers()
    repos = createMockRepos()
  })

  afterEach(() => {
    service?.destroy()
    vi.useRealTimers()
  })

  describe('constructor', () => {
    it('starts eviction interval timer', () => {
      service = new ConfigService(repos, { evictionIntervalMs: 5000 })
      expect(service.cacheSize).toBe(0)
    })

    it('uses default idle timeout of 30 minutes', async () => {
      service = new ConfigService(repos)
      // Load a user to populate cache
      await service.getForUser('user-1')
      expect(service.cacheSize).toBe(1)

      // Advance time by 29 minutes — should not evict
      vi.advanceTimersByTime(29 * 60 * 1000)
      service.evictIdle()
      expect(service.cacheSize).toBe(1)

      // Advance past 30 minutes total
      vi.advanceTimersByTime(2 * 60 * 1000)
      service.evictIdle()
      expect(service.cacheSize).toBe(0)
    })
  })

  describe('getForUser', () => {
    it('loads config from DB on cache miss', async () => {
      service = new ConfigService(repos)
      const config = await service.getForUser('user-1')

      expect(repos.scene.findAll).toHaveBeenCalledWith('user-1')
      expect(repos.application.findAll).toHaveBeenCalledWith('user-1')
      expect(repos.keybind.find).toHaveBeenCalledWith('user-1')
      expect(repos.obsConfig.find).toHaveBeenCalledWith('user-1')
      expect(repos.audioConfig.find).toHaveBeenCalledWith('user-1')
      expect(repos.overlayStyle.find).toHaveBeenCalledWith('user-1')
      expect(repos.desktop.find).toHaveBeenCalledWith('user-1')
      expect(repos.ambiance.find).toHaveBeenCalledWith('user-1')
      expect(repos.event.findAll).toHaveBeenCalledWith('user-1')
      expect(repos.media.findAll).toHaveBeenCalledWith('user-1')
      expect(repos.sourcePreset.findAll).toHaveBeenCalledWith('user-1')
      expect(repos.povConfig.getPovConfig).toHaveBeenCalledWith('user-1')
      expect(repos.onlineConfig.getOnlineConfig).toHaveBeenCalledWith('user-1')

      expect(config).toBeDefined()
      expect(config.scenes).toBeDefined()
      expect(config.applications).toBeDefined()
    })

    it('returns cached config on subsequent calls', async () => {
      service = new ConfigService(repos)
      const config1 = await service.getForUser('user-1')
      const config2 = await service.getForUser('user-1')

      // Should only call DB once
      expect(repos.scene.findAll).toHaveBeenCalledTimes(1)
      expect(config1).toBe(config2)
    })

    it('maintains separate caches per user', async () => {
      service = new ConfigService(repos)
      await service.getForUser('user-1')
      await service.getForUser('user-2')

      expect(repos.scene.findAll).toHaveBeenCalledWith('user-1')
      expect(repos.scene.findAll).toHaveBeenCalledWith('user-2')
      expect(repos.scene.findAll).toHaveBeenCalledTimes(2)
      expect(service.cacheSize).toBe(2)
    })

    it('updates lastAccess on cache hit', async () => {
      service = new ConfigService(repos, { idleTimeoutMs: 5000 })
      await service.getForUser('user-1')

      // Advance time by 4 seconds
      vi.advanceTimersByTime(4000)

      // Access again — should refresh lastAccess
      await service.getForUser('user-1')

      // Advance another 4 seconds (total 8 from start, but only 4 from last access)
      vi.advanceTimersByTime(4000)
      service.evictIdle()

      // Should still be cached because last access was 4s ago, not 8s
      expect(service.cacheSize).toBe(1)
    })
  })

  describe('persistForUser', () => {
    it('persists to appropriate repositories based on updates', async () => {
      service = new ConfigService(repos)
      const config = await service.getForUser('user-1')

      const updates: Partial<AppConfig> = { audio: { masterVolume: 1.0, sfxVolume: 0.5, musicVolume: 0.3 } }
      const merged = { ...config, ...updates }

      await service.persistForUser('user-1', merged, updates)

      expect(repos.audioConfig.save).toHaveBeenCalledWith('user-1', expect.objectContaining({ masterVolume: 1.0 }))
      // Should NOT have called scene save since scenes weren't in updates
      expect(repos.scene.saveAll).not.toHaveBeenCalled()
    })

    it('persists all sections when no updates specified', async () => {
      service = new ConfigService(repos)
      const config = await service.getForUser('user-1')

      await service.persistForUser('user-1', config)

      expect(repos.scene.saveAll).toHaveBeenCalled()
      expect(repos.application.saveAll).toHaveBeenCalled()
      expect(repos.keybind.save).toHaveBeenCalled()
      expect(repos.obsConfig.save).toHaveBeenCalled()
      expect(repos.audioConfig.save).toHaveBeenCalled()
      expect(repos.overlayStyle.save).toHaveBeenCalled()
    })

    it('updates the cache after persisting', async () => {
      service = new ConfigService(repos)
      await service.getForUser('user-1')

      const newConfig = structuredClone(DEFAULT_CONFIG)
      newConfig.audio = { masterVolume: 0.5, sfxVolume: 0.5, musicVolume: 0.5 }

      const result = await service.persistForUser('user-1', newConfig, { audio: newConfig.audio })

      // Subsequent get should return cached value without hitting DB
      const cached = await service.getForUser('user-1')
      expect(repos.scene.findAll).toHaveBeenCalledTimes(1) // only the initial load
      expect(cached.audio.masterVolume).toBe(0.5)
    })

    it('emits config:update and config:patch to user room', async () => {
      const mockIo = createMockIo()
      service = new ConfigService(repos, { io: mockIo as any })

      const config = await service.getForUser('user-1')
      const updates: Partial<AppConfig> = { audio: { masterVolume: 0.9, sfxVolume: 0.7, musicVolume: 0.4 } }
      const merged = { ...config, audio: updates.audio! }

      await service.persistForUser('user-1', merged, updates)

      expect(mockIo._toFn).toHaveBeenCalledWith('user:user-1')
      // config:update is emitted
      expect(mockIo._emitFn).toHaveBeenCalledWith('config:update', expect.any(Object))
      // config:patch is emitted
      expect(mockIo._emitFn).toHaveBeenCalledWith('config:patch', expect.objectContaining({ audio: expect.any(Object) }))
    })

    it('does not emit config:patch when updates is empty', async () => {
      const mockIo = createMockIo()
      service = new ConfigService(repos, { io: mockIo as any })

      const config = await service.getForUser('user-1')
      await service.persistForUser('user-1', config, {})

      // config:update should still be emitted
      const emitCalls = mockIo._emitFn.mock.calls
      const patchCalls = emitCalls.filter((call: any[]) => call[0] === 'config:patch')
      expect(patchCalls.length).toBe(0)
    })

    it('emits events only to the specific user room, not globally', async () => {
      const mockIo = createMockIo()
      service = new ConfigService(repos, { io: mockIo as any })

      const config = await service.getForUser('user-1')
      await service.persistForUser('user-1', config, { audio: config.audio })

      // Verify .to() was called with the correct user room
      expect(mockIo._toFn).toHaveBeenCalledWith('user:user-1')
      expect(mockIo._toFn).not.toHaveBeenCalledWith('user:user-2')
    })
  })

  describe('seedNewUser', () => {
    it('calls BEGIN, inserts, and COMMIT on the pool client', async () => {
      const mockQuery = vi.fn().mockResolvedValue({ rows: [] })
      const mockRelease = vi.fn()
      const mockClient = { query: mockQuery, release: mockRelease }
      ;(repos.scene as any).pool = { connect: vi.fn().mockResolvedValue(mockClient) }

      service = new ConfigService(repos)
      await service.seedNewUser('new-user-id')

      // Verify transaction lifecycle
      const queries = mockQuery.mock.calls.map((call: any[]) => call[0])
      expect(queries[0]).toBe('BEGIN')
      expect(queries[queries.length - 1]).toBe('COMMIT')
      expect(mockRelease).toHaveBeenCalled()
    })

    it('rolls back on failure and re-throws', async () => {
      const mockQuery = vi.fn()
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockRejectedValueOnce(new Error('insert failed')) // first insert fails
      const mockRelease = vi.fn()
      const mockClient = { query: mockQuery, release: mockRelease }
      ;(repos.scene as any).pool = { connect: vi.fn().mockResolvedValue(mockClient) }

      service = new ConfigService(repos)

      await expect(service.seedNewUser('new-user-id')).rejects.toThrow('insert failed')

      const queries = mockQuery.mock.calls.map((call: any[]) => call[0])
      expect(queries).toContain('ROLLBACK')
      expect(queries).not.toContain('COMMIT')
      expect(mockRelease).toHaveBeenCalled()
    })
  })

  describe('evictIdle', () => {
    it('removes entries idle longer than timeout', async () => {
      service = new ConfigService(repos, { idleTimeoutMs: 5000 })

      await service.getForUser('user-1')
      await service.getForUser('user-2')
      expect(service.cacheSize).toBe(2)

      // Advance time past idle timeout
      vi.advanceTimersByTime(6000)
      service.evictIdle()

      expect(service.cacheSize).toBe(0)
    })

    it('retains entries accessed within timeout', async () => {
      service = new ConfigService(repos, { idleTimeoutMs: 5000 })

      await service.getForUser('user-1')
      await service.getForUser('user-2')

      // Advance 3 seconds
      vi.advanceTimersByTime(3000)

      // Access user-1 to refresh its lastAccess
      await service.getForUser('user-1')

      // Advance another 3 seconds (user-2 is now 6s idle, user-1 is 3s idle)
      vi.advanceTimersByTime(3000)
      service.evictIdle()

      expect(service.cacheSize).toBe(1)
      // user-1 should still be cached
      const config = await service.getForUser('user-1')
      expect(config).toBeDefined()
      // user-1 was served from cache (no additional DB call)
      expect(repos.scene.findAll).toHaveBeenCalledTimes(2) // initial loads for user-1 and user-2
    })

    it('runs automatically on the configured interval', async () => {
      service = new ConfigService(repos, { idleTimeoutMs: 1000, evictionIntervalMs: 2000 })

      await service.getForUser('user-1')
      expect(service.cacheSize).toBe(1)

      // Advance past idle timeout AND past eviction interval
      vi.advanceTimersByTime(3000)

      // The interval should have fired and evicted
      expect(service.cacheSize).toBe(0)
    })
  })

  describe('destroy', () => {
    it('stops the eviction timer', async () => {
      service = new ConfigService(repos, { idleTimeoutMs: 1000, evictionIntervalMs: 2000 })

      await service.getForUser('user-1')
      service.destroy()

      // Advance time — eviction should NOT run
      vi.advanceTimersByTime(5000)
      expect(service.cacheSize).toBe(1)
    })
  })

  describe('cache isolation between users', () => {
    it('persisting for user A does not affect user B cache', async () => {
      service = new ConfigService(repos)

      const configA = await service.getForUser('user-a')
      const configB = await service.getForUser('user-b')

      // Modify user A's audio
      const updatedA = { ...configA, audio: { masterVolume: 0.1, sfxVolume: 0.1, musicVolume: 0.1 } }
      await service.persistForUser('user-a', updatedA, { audio: updatedA.audio })

      // User B's config should be unchanged
      const configBAfter = await service.getForUser('user-b')
      expect(configBAfter.audio).toEqual(configB.audio)
    })
  })
})
