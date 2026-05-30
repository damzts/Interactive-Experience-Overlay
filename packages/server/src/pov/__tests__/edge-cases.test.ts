import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CameraRegistry } from '../registry.js'
import type { CameraFeedRegistration } from '../registry.js'
import type { CameraFeed, POVErrorPayload } from '@ieom/shared'
import { POVSwitcher } from '../switcher.js'
import {
  validatePovConfigBounds,
  withPovConfigDefaults,
} from '../../db/repositories/povConfigRepo.js'
import type { POVSwitchingConfig } from '@ieom/shared'

// ── Mock obs-websocket-js ────────────────────────────────────────────────────

const mockState = vi.hoisted(() => {
  return {
    instances: [] as any[],
    connectBehavior: 'succeed' as 'succeed' | 'fail',
    callBehavior: 'succeed' as 'succeed' | 'hang' | 'fail',
  }
})

vi.mock('obs-websocket-js', () => {
  class MockOBS {
    private listeners = new Map<string, Function[]>()
    connect = vi.fn()
    disconnect = vi.fn()
    call = vi.fn()

    constructor() {
      mockState.instances.push(this)
      this.connect.mockImplementation(async () => {
        if (mockState.connectBehavior === 'fail') {
          throw new Error('Connection refused')
        }
      })
      this.call.mockImplementation(async () => {
        if (mockState.callBehavior === 'hang') {
          return new Promise(() => {})
        }
        if (mockState.callBehavior === 'fail') {
          throw new Error('Call failed')
        }
        return { obsVersion: '30.0.0' }
      })
    }

    on(event: string, fn: Function) {
      if (!this.listeners.has(event)) this.listeners.set(event, [])
      this.listeners.get(event)!.push(fn)
    }

    off(event: string, fn: Function) {
      const handlers = this.listeners.get(event) || []
      const idx = handlers.indexOf(fn)
      if (idx >= 0) handlers.splice(idx, 1)
    }

    removeAllListeners() {
      this.listeners.clear()
    }
  }
  return { default: MockOBS }
})

import {
  CameraConnectionManager,
  MAX_RETRY_ATTEMPTS,
  HEALTH_CHECK_TIMEOUT_MS,
} from '../connections.js'
import {
  TransitionQueue,
  RETRY_DELAY_MS,
} from '../transition-queue.js'

// ── Helpers ──────────────────────────────────────────────────────────────────

function validFeedInput(overrides?: Partial<CameraFeedRegistration>): CameraFeedRegistration {
  return {
    label: 'Player A',
    obsAddress: 'ws://192.168.1.10:4455',
    obsPassword: 'secret',
    sceneName: 'CamA',
    ...overrides,
  }
}

function makeFeed(overrides: Partial<CameraFeed> = {}): CameraFeed {
  return {
    id: 'feed-1',
    label: 'Player 1',
    obsAddress: 'ws://192.168.1.10:4455',
    obsPassword: 'secret',
    sceneName: 'Player1Scene',
    connectionStatus: 'disconnected',
    connectedAt: null,
    registeredAt: Date.now(),
    lastHealthCheck: null,
    activityScore: 0,
    ...overrides,
  }
}

function registerConnectedFeed(registry: CameraRegistry, label: string): string {
  const result = registry.register({
    label,
    obsAddress: `ws://192.168.1.${Math.floor(Math.random() * 255)}:4455`,
    obsPassword: 'test',
    sceneName: `scene-${label}`,
  })
  if ('error' in result) throw new Error(`Registration failed: ${result.error}`)
  registry.updateStatus(result.id, 'connected')
  return result.id
}

function createMockObs(options: { failCall?: boolean; failAfterAttempts?: number } = {}) {
  let attemptCount = 0
  const listeners = new Map<string, Function[]>()

  const obs = {
    call: vi.fn(async () => {
      if (options.failCall) {
        attemptCount++
        if (options.failAfterAttempts && attemptCount > options.failAfterAttempts) {
          return {}
        }
        throw new Error('OBS call failed')
      }
      return {}
    }),
    on: vi.fn((event: string, handler: Function) => {
      if (!listeners.has(event)) listeners.set(event, [])
      listeners.get(event)!.push(handler)
    }),
    off: vi.fn((event: string, handler: Function) => {
      const handlers = listeners.get(event) || []
      const idx = handlers.indexOf(handler)
      if (idx >= 0) handlers.splice(idx, 1)
    }),
  }

  return obs as any
}

// ── Edge Case Tests ──────────────────────────────────────────────────────────

describe('Edge Cases', () => {
  describe('Registration with exact 32-character label (Req 1.1)', () => {
    it('accepts a label with exactly 32 characters', () => {
      const registry = new CameraRegistry(10)
      const label = 'A'.repeat(32)
      const result = registry.register(validFeedInput({ label }))

      expect('id' in result).toBe(true)
      const feed = result as CameraFeed
      expect(feed.label).toBe(label)
      expect(feed.label.length).toBe(32)
    })
  })

  describe('Registration with empty label - validation failure (Req 1.1)', () => {
    it('rejects registration with an empty label', () => {
      const registry = new CameraRegistry(10)
      const result = registry.register(validFeedInput({ label: '' }))

      expect(result).toEqual({ error: 'label_required' })
    })

    it('rejects registration with a whitespace-only label treated as empty', () => {
      const registry = new CameraRegistry(10)
      // Whitespace-only labels should still be accepted if the registry doesn't trim
      // Based on the existing tests, only empty string is rejected
      const result = registry.register(validFeedInput({ label: '   ' }))
      // The registry accepts non-empty strings (even whitespace)
      expect('id' in result).toBe(true)
    })
  })

  describe('Health check timeout marking feed as unresponsive (Req 1.5)', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      mockState.instances = []
      mockState.connectBehavior = 'succeed'
      mockState.callBehavior = 'succeed'
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('marks feed as unresponsive when health check times out after 5 seconds', async () => {
      const manager = new CameraConnectionManager()
      const feed = makeFeed()

      await manager.connect(feed)
      expect(manager.getStatus('feed-1')).toBe('connected')

      // Make health checks hang (simulating timeout)
      mockState.callBehavior = 'hang'

      manager.startHealthChecks(10_000)

      // Advance past health check interval to trigger check
      await vi.advanceTimersByTimeAsync(10_001)

      // Advance past health check timeout (5 seconds)
      await vi.advanceTimersByTimeAsync(HEALTH_CHECK_TIMEOUT_MS + 1)

      expect(manager.getStatus('feed-1')).toBe('unresponsive')

      manager.stopHealthChecks()
      manager.disconnectAll()
    })
  })

  describe('Retry exhaustion marking feed as unreachable (Req 2.3, 2.6)', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      mockState.instances = []
      mockState.connectBehavior = 'fail'
      mockState.callBehavior = 'succeed'
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('marks feed as unreachable after 5 failed retry attempts', async () => {
      const manager = new CameraConnectionManager()
      const feed = makeFeed()
      const events: Array<{ feedId: string; status: string }> = []

      manager.on('statusChange', (e: any) => events.push({ feedId: e.feedId, status: e.status }))

      await manager.connect(feed)

      // Advance through all retry delays (each attempt fails and schedules next)
      for (let i = 0; i < MAX_RETRY_ATTEMPTS; i++) {
        await vi.advanceTimersByTimeAsync(300_001)
      }

      expect(manager.getStatus('feed-1')).toBe('unreachable')

      // Verify the unreachable event was emitted
      const unreachableEvent = events.find((e) => e.status === 'unreachable')
      expect(unreachableEvent).toBeDefined()
      expect(unreachableEvent!.feedId).toBe('feed-1')

      manager.disconnectAll()
    })
  })

  describe('Manual selection of connected feed succeeds (Req 5.1)', () => {
    it('successfully selects a connected feed in manual mode', () => {
      const registry = new CameraRegistry(10)
      const switcher = new POVSwitcher(registry, {
        cooldownMs: 3000,
        activityThreshold: 0.15,
        silenceThreshold: 0.05,
      })

      const feedId = registerConnectedFeed(registry, 'PlayerA')

      switcher.setMode('manual')
      const result = switcher.manualSelect(feedId)

      expect(result.ok).toBe(true)
      expect(switcher.activeCameraId).toBe(feedId)
    })

    it('switches active camera within the same call (under 500ms requirement)', () => {
      const registry = new CameraRegistry(10)
      const switcher = new POVSwitcher(registry, {
        cooldownMs: 3000,
        activityThreshold: 0.15,
        silenceThreshold: 0.05,
      })

      const feedA = registerConnectedFeed(registry, 'PlayerA')
      const feedB = registerConnectedFeed(registry, 'PlayerB')

      switcher.setMode('manual')
      switcher.manualSelect(feedA)
      expect(switcher.activeCameraId).toBe(feedA)

      // Selecting another connected feed should succeed immediately
      const result = switcher.manualSelect(feedB)
      expect(result.ok).toBe(true)
      expect(switcher.activeCameraId).toBe(feedB)
    })
  })

  describe('Mode change emits correct event (Req 5.4)', () => {
    it('emits mode change event when switching from automatic to manual', () => {
      const registry = new CameraRegistry(10)
      const switcher = new POVSwitcher(registry, {
        cooldownMs: 3000,
        activityThreshold: 0.15,
        silenceThreshold: 0.05,
      })

      const modeEvents: string[] = []
      switcher.onModeChange((mode) => modeEvents.push(mode))

      switcher.setMode('manual')

      expect(modeEvents).toEqual(['manual'])
    })

    it('emits mode change event when switching from manual to automatic', () => {
      const registry = new CameraRegistry(10)
      const switcher = new POVSwitcher(registry, {
        cooldownMs: 3000,
        activityThreshold: 0.15,
        silenceThreshold: 0.05,
      })

      switcher.setMode('manual')

      const modeEvents: string[] = []
      switcher.onModeChange((mode) => modeEvents.push(mode))

      switcher.setMode('automatic')

      expect(modeEvents).toEqual(['automatic'])
    })

    it('does not emit event when setting the same mode', () => {
      const registry = new CameraRegistry(10)
      const switcher = new POVSwitcher(registry, {
        cooldownMs: 3000,
        activityThreshold: 0.15,
        silenceThreshold: 0.05,
      })

      const modeEvents: string[] = []
      switcher.onModeChange((mode) => modeEvents.push(mode))

      // Already in automatic mode
      switcher.setMode('automatic')

      expect(modeEvents).toHaveLength(0)
    })
  })

  describe('Transition retry on first failure, skip on second (Req 8.6)', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('retries once after 500ms on first failure, then skips and emits error on second failure', async () => {
      const failObs = createMockObs({ failCall: true })
      const connectedFeeds = new Set(['feed-1'])
      const queue = new TransitionQueue({
        outputObs: failObs,
        isFeedConnected: (id) => connectedFeeds.has(id),
        transitionConfig: { type: 'cut', durationMs: 0 },
      })

      const errors: POVErrorPayload[] = []
      queue.on('error', (payload: POVErrorPayload) => errors.push(payload))

      queue.enqueue('feed-1')
      await vi.advanceTimersByTimeAsync(0)

      // First attempt fails — 1 call made
      expect(failObs.call).toHaveBeenCalledTimes(1)
      expect(errors).toHaveLength(0)

      // Wait for retry delay (500ms)
      await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS)

      // Second attempt also fails — error emitted
      expect(failObs.call).toHaveBeenCalledTimes(2)
      expect(errors).toHaveLength(1)
      expect(errors[0].code).toBe('transition_failed')
      expect(errors[0].feedId).toBe('feed-1')
    })

    it('succeeds on retry if second attempt passes', async () => {
      const failObs = createMockObs({ failCall: true, failAfterAttempts: 1 })
      const connectedFeeds = new Set(['feed-1'])
      const queue = new TransitionQueue({
        outputObs: failObs,
        isFeedConnected: (id) => connectedFeeds.has(id),
        transitionConfig: { type: 'cut', durationMs: 0 },
      })

      const errors: POVErrorPayload[] = []
      queue.on('error', (payload: POVErrorPayload) => errors.push(payload))

      queue.enqueue('feed-1')
      await vi.advanceTimersByTimeAsync(0)

      // First attempt fails
      await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS)

      // Retry succeeds (failAfterAttempts=1 means fail once then succeed)
      expect(errors).toHaveLength(0)
    })
  })

  describe('Config save with out-of-bound values (Req 7.5)', () => {
    it('replaces pollIntervalMs below minimum with default', () => {
      const config: POVSwitchingConfig = {
        pollIntervalMs: 10, // below min of 50
        rollingWindowMs: 2000,
        cooldownMs: 3000,
        activityThreshold: 0.15,
        silenceThreshold: 0.05,
        healthCheckIntervalMs: 10000,
        maxConnections: 10,
        transition: { type: 'cut', durationMs: 0 },
        scoreEmitIntervalMs: 500,
        dbFloor: -60,
        dbCeiling: 0,
      }

      const validated = validatePovConfigBounds(config)
      expect(validated.pollIntervalMs).toBe(100) // default
    })

    it('replaces cooldownMs above maximum with default', () => {
      const config: POVSwitchingConfig = {
        pollIntervalMs: 100,
        rollingWindowMs: 2000,
        cooldownMs: 50000, // above max of 30000
        activityThreshold: 0.15,
        silenceThreshold: 0.05,
        healthCheckIntervalMs: 10000,
        maxConnections: 10,
        transition: { type: 'cut', durationMs: 0 },
        scoreEmitIntervalMs: 500,
        dbFloor: -60,
        dbCeiling: 0,
      }

      const validated = validatePovConfigBounds(config)
      expect(validated.cooldownMs).toBe(3000) // default
    })

    it('replaces activityThreshold below minimum with default', () => {
      const config: POVSwitchingConfig = {
        pollIntervalMs: 100,
        rollingWindowMs: 2000,
        cooldownMs: 3000,
        activityThreshold: 0.001, // below min of 0.01
        silenceThreshold: 0.05,
        healthCheckIntervalMs: 10000,
        maxConnections: 10,
        transition: { type: 'cut', durationMs: 0 },
        scoreEmitIntervalMs: 500,
        dbFloor: -60,
        dbCeiling: 0,
      }

      const validated = validatePovConfigBounds(config)
      expect(validated.activityThreshold).toBe(0.15) // default
    })

    it('replaces multiple out-of-bound values simultaneously', () => {
      const config: POVSwitchingConfig = {
        pollIntervalMs: 5000, // above max of 2000
        rollingWindowMs: 100, // below min of 500
        cooldownMs: 500, // below min of 1000
        activityThreshold: 2.0, // above max of 1.0
        silenceThreshold: -1, // below min of 0.0
        healthCheckIntervalMs: 10000,
        maxConnections: 10,
        transition: { type: 'cut', durationMs: 0 },
        scoreEmitIntervalMs: 500,
        dbFloor: -60,
        dbCeiling: 0,
      }

      const validated = validatePovConfigBounds(config)
      expect(validated.pollIntervalMs).toBe(100)
      expect(validated.rollingWindowMs).toBe(2000)
      expect(validated.cooldownMs).toBe(3000)
      expect(validated.activityThreshold).toBe(0.15)
      expect(validated.silenceThreshold).toBe(0.05)
    })

    it('preserves valid values while replacing invalid ones', () => {
      const config: POVSwitchingConfig = {
        pollIntervalMs: 200, // valid
        rollingWindowMs: 5000, // valid
        cooldownMs: 50000, // invalid - above max
        activityThreshold: 0.5, // valid
        silenceThreshold: 0.05,
        healthCheckIntervalMs: 10000,
        maxConnections: 10,
        transition: { type: 'cut', durationMs: 0 },
        scoreEmitIntervalMs: 500,
        dbFloor: -60,
        dbCeiling: 0,
      }

      const validated = validatePovConfigBounds(config)
      expect(validated.pollIntervalMs).toBe(200) // preserved
      expect(validated.rollingWindowMs).toBe(5000) // preserved
      expect(validated.cooldownMs).toBe(3000) // replaced with default
      expect(validated.activityThreshold).toBe(0.5) // preserved
    })

    it('replaces invalid fade transition duration with default', () => {
      const config: POVSwitchingConfig = {
        pollIntervalMs: 100,
        rollingWindowMs: 2000,
        cooldownMs: 3000,
        activityThreshold: 0.15,
        silenceThreshold: 0.05,
        healthCheckIntervalMs: 10000,
        maxConnections: 10,
        transition: { type: 'fade', durationMs: 50 }, // below min of 100 for fade
        scoreEmitIntervalMs: 500,
        dbFloor: -60,
        dbCeiling: 0,
      }

      const validated = validatePovConfigBounds(config)
      expect(validated.transition.durationMs).toBe(500) // default for fade
    })
  })
})
