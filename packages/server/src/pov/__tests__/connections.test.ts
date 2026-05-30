import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { CameraFeed } from '@ieom/shared'
import type { ConnectionStatusChangeEvent } from '../connections.js'

// ── Mock obs-websocket-js ────────────────────────────────────────────────────

// Use vi.hoisted to define mock state that's accessible in the hoisted vi.mock factory
const mockState = vi.hoisted(() => {
  return {
    instances: [] as any[],
    connectBehavior: 'succeed' as 'succeed' | 'fail' | 'fail-once',
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
        if (mockState.connectBehavior === 'fail-once') {
          mockState.connectBehavior = 'succeed'
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

    removeAllListeners() {
      this.listeners.clear()
    }

    simulateClose() {
      const handlers = this.listeners.get('ConnectionClosed') || []
      for (const h of handlers) h()
    }
  }
  return { default: MockOBS }
})

// Import after mock setup
import {
  CameraConnectionManager,
  computeRetryDelay,
  MAX_RETRY_ATTEMPTS,
  HEALTH_CHECK_TIMEOUT_MS,
} from '../connections.js'

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── Tests ────────────────────────────────────────────────────────────────────

describe('computeRetryDelay', () => {
  it('returns 15000 for attempt 0', () => {
    expect(computeRetryDelay(0)).toBe(15_000)
  })

  it('returns 30000 for attempt 1', () => {
    expect(computeRetryDelay(1)).toBe(30_000)
  })

  it('returns 60000 for attempt 2', () => {
    expect(computeRetryDelay(2)).toBe(60_000)
  })

  it('returns 120000 for attempt 3', () => {
    expect(computeRetryDelay(3)).toBe(120_000)
  })

  it('returns 240000 for attempt 4', () => {
    expect(computeRetryDelay(4)).toBe(240_000)
  })

  it('caps at 300000 for attempt 5+', () => {
    expect(computeRetryDelay(5)).toBe(300_000)
    expect(computeRetryDelay(10)).toBe(300_000)
  })
})

describe('CameraConnectionManager', () => {
  let manager: CameraConnectionManager

  beforeEach(() => {
    vi.useFakeTimers()
    mockState.instances = []
    mockState.connectBehavior = 'succeed'
    mockState.callBehavior = 'succeed'
    manager = new CameraConnectionManager()
  })

  afterEach(() => {
    manager.disconnectAll()
    vi.useRealTimers()
  })

  describe('connect', () => {
    it('connects to a feed and emits status changes', async () => {
      const feed = makeFeed()
      const events: ConnectionStatusChangeEvent[] = []
      manager.on('statusChange', (e: ConnectionStatusChangeEvent) => events.push(e))

      await manager.connect(feed)

      expect(events).toHaveLength(2)
      expect(events[0]).toEqual({
        feedId: 'feed-1',
        status: 'reconnecting',
        previousStatus: 'disconnected',
      })
      expect(events[1]).toEqual({
        feedId: 'feed-1',
        status: 'connected',
        previousStatus: 'reconnecting',
      })
    })

    it('marks feed as connected after successful connection', async () => {
      const feed = makeFeed()
      await manager.connect(feed)

      expect(manager.isConnected('feed-1')).toBe(true)
      expect(manager.getStatus('feed-1')).toBe('connected')
    })

    it('returns the OBS instance for a connected feed', async () => {
      const feed = makeFeed()
      await manager.connect(feed)

      const obs = manager.getConnection('feed-1')
      expect(obs).toBeDefined()
    })

    it('returns undefined for a nonexistent feed', () => {
      expect(manager.getConnection('nonexistent')).toBeUndefined()
    })
  })

  describe('connection failure and retry', () => {
    it('schedules retry on connection failure', async () => {
      mockState.connectBehavior = 'fail'

      const feed = makeFeed()
      await manager.connect(feed)

      expect(manager.getStatus('feed-1')).toBe('reconnecting')
    })

    it('marks feed as unreachable after max retry attempts', async () => {
      mockState.connectBehavior = 'fail'

      const feed = makeFeed()
      await manager.connect(feed)

      // Advance through all retry delays (each attempt fails and schedules next)
      for (let i = 0; i < MAX_RETRY_ATTEMPTS; i++) {
        await vi.advanceTimersByTimeAsync(300_001)
      }

      expect(manager.getStatus('feed-1')).toBe('unreachable')
    })

    it('retries with exponential backoff delays', async () => {
      mockState.connectBehavior = 'fail'

      const feed = makeFeed()
      await manager.connect(feed)

      // After first attempt fails, retry is scheduled at 15s
      // Advance 14s — should still be reconnecting
      await vi.advanceTimersByTimeAsync(14_999)
      expect(manager.getStatus('feed-1')).toBe('reconnecting')

      // Advance past 15s — retry fires, fails again
      await vi.advanceTimersByTimeAsync(2)
      expect(manager.getStatus('feed-1')).toBe('reconnecting')
    })
  })

  describe('disconnect', () => {
    it('removes the feed from tracking', async () => {
      const feed = makeFeed()
      await manager.connect(feed)

      manager.disconnect('feed-1')

      expect(manager.isConnected('feed-1')).toBe(false)
      expect(manager.getStatus('feed-1')).toBeUndefined()
      expect(manager.getConnection('feed-1')).toBeUndefined()
    })

    it('clears retry timers on disconnect', async () => {
      mockState.connectBehavior = 'fail'
      const feed = makeFeed()
      await manager.connect(feed)

      expect(manager.getStatus('feed-1')).toBe('reconnecting')

      manager.disconnect('feed-1')

      // Advancing time should not cause errors
      await vi.advanceTimersByTimeAsync(300_001)
      expect(manager.getStatus('feed-1')).toBeUndefined()
    })
  })

  describe('disconnectAll', () => {
    it('disconnects all feeds', async () => {
      const feed1 = makeFeed({ id: 'feed-1' })
      const feed2 = makeFeed({ id: 'feed-2', obsAddress: 'ws://192.168.1.11:4455' })

      await manager.connect(feed1)
      await manager.connect(feed2)

      manager.disconnectAll()

      expect(manager.isConnected('feed-1')).toBe(false)
      expect(manager.isConnected('feed-2')).toBe(false)
    })
  })

  describe('connection isolation', () => {
    it('one feed failing does not affect others', async () => {
      // First feed connects successfully
      const feed1 = makeFeed({ id: 'feed-1' })
      await manager.connect(feed1)
      expect(manager.isConnected('feed-1')).toBe(true)

      // Second feed fails to connect
      mockState.connectBehavior = 'fail'
      const feed2 = makeFeed({ id: 'feed-2', obsAddress: 'ws://192.168.1.11:4455' })
      await manager.connect(feed2)

      // Feed 1 should still be connected
      expect(manager.isConnected('feed-1')).toBe(true)
      expect(manager.getStatus('feed-1')).toBe('connected')

      // Feed 2 should be in reconnecting state
      expect(manager.isConnected('feed-2')).toBe(false)
      expect(manager.getStatus('feed-2')).toBe('reconnecting')
    })

    it('ConnectionClosed on one feed does not affect others', async () => {
      const feed1 = makeFeed({ id: 'feed-1' })
      const feed2 = makeFeed({ id: 'feed-2', obsAddress: 'ws://192.168.1.11:4455' })

      await manager.connect(feed1)
      await manager.connect(feed2)

      expect(manager.isConnected('feed-1')).toBe(true)
      expect(manager.isConnected('feed-2')).toBe(true)

      // Simulate feed-1 disconnecting (first instance created)
      const feed1Instance = mockState.instances[0]
      feed1Instance.simulateClose()

      // Feed 1 should be disconnected, feed 2 unaffected
      expect(manager.getStatus('feed-1')).not.toBe('connected')
      expect(manager.isConnected('feed-2')).toBe(true)
    })
  })

  describe('health checks', () => {
    it('starts and stops health check polling', async () => {
      const feed = makeFeed()
      await manager.connect(feed)

      manager.startHealthChecks(10_000)

      // Advance past one health check interval
      await vi.advanceTimersByTimeAsync(10_001)

      // Should still be connected (health check passes with mock)
      expect(manager.getStatus('feed-1')).toBe('connected')

      manager.stopHealthChecks()
    })

    it('marks feed as unresponsive on health check timeout', async () => {
      const feed = makeFeed()
      await manager.connect(feed)

      // Make health checks hang
      mockState.callBehavior = 'hang'

      manager.startHealthChecks(10_000)

      // Advance past health check interval to trigger check
      await vi.advanceTimersByTimeAsync(10_001)

      // Advance past health check timeout
      await vi.advanceTimersByTimeAsync(HEALTH_CHECK_TIMEOUT_MS + 1)

      expect(manager.getStatus('feed-1')).toBe('unresponsive')

      manager.stopHealthChecks()
    })

    it('restores connected status when health check recovers', async () => {
      const feed = makeFeed()
      await manager.connect(feed)

      // First: make health check hang to trigger unresponsive
      mockState.callBehavior = 'hang'
      manager.startHealthChecks(10_000)

      await vi.advanceTimersByTimeAsync(10_001)
      await vi.advanceTimersByTimeAsync(HEALTH_CHECK_TIMEOUT_MS + 1)
      expect(manager.getStatus('feed-1')).toBe('unresponsive')

      // Now: make health check succeed
      mockState.callBehavior = 'succeed'

      // Trigger next health check
      await vi.advanceTimersByTimeAsync(10_000)

      expect(manager.getStatus('feed-1')).toBe('connected')

      manager.stopHealthChecks()
    })

    it('does not health-check feeds that are reconnecting', async () => {
      mockState.connectBehavior = 'fail'
      const feed = makeFeed()
      await manager.connect(feed)

      // Feed is in reconnecting state
      expect(manager.getStatus('feed-1')).toBe('reconnecting')

      // Start health checks
      manager.startHealthChecks(10_000)

      // Clear call mock to track new calls
      const instance = mockState.instances[0]
      instance.call.mockClear()

      await vi.advanceTimersByTimeAsync(10_001)

      // call should not have been invoked for health check on reconnecting feed
      expect(instance.call).not.toHaveBeenCalled()

      manager.stopHealthChecks()
    })
  })
})
