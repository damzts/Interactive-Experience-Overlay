import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'
import type { CameraFeed, CameraConnectionStatus } from '@ieom/shared'
import type { ConnectionStatusChangeEvent } from '../connections.js'

// ── Mock obs-websocket-js ────────────────────────────────────────────────────

const mockState = vi.hoisted(() => {
  return {
    instances: [] as any[],
    connectBehaviorByIndex: new Map<number, 'succeed' | 'fail'>(),
    defaultConnectBehavior: 'succeed' as 'succeed' | 'fail',
  }
})

vi.mock('obs-websocket-js', () => {
  class MockOBS {
    private listeners = new Map<string, Function[]>()
    private instanceIndex: number
    connect = vi.fn()
    disconnect = vi.fn()
    call = vi.fn()

    constructor() {
      this.instanceIndex = mockState.instances.length
      mockState.instances.push(this)
      this.connect.mockImplementation(async () => {
        const behavior =
          mockState.connectBehaviorByIndex.get(this.instanceIndex) ??
          mockState.defaultConnectBehavior
        if (behavior === 'fail') {
          throw new Error('Connection refused')
        }
      })
      this.call.mockImplementation(async () => {
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

import {
  CameraConnectionManager,
  computeRetryDelay,
  MAX_RETRY_ATTEMPTS,
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

function resetMockState() {
  mockState.instances = []
  mockState.connectBehaviorByIndex.clear()
  mockState.defaultConnectBehavior = 'succeed'
}

// ── Property Tests ───────────────────────────────────────────────────────────

describe('CameraConnectionManager - Property Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetMockState()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Property 4: Exponential backoff computation', () => {
    /**
     * **Validates: Requirements 2.3**
     *
     * For attempt n (0-4), the backoff delay is 15000 * 2^n, capped at 300000ms.
     * No more than 5 retry attempts are made before marking the feed as unreachable.
     */
    it('computes correct delay for any attempt 0-4: delay = min(15000 * 2^n, 300000)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 4 }),
          (attempt) => {
            const expected = Math.min(15_000 * Math.pow(2, attempt), 300_000)
            const actual = computeRetryDelay(attempt)
            return actual === expected
          }
        ),
        { numRuns: 100 }
      )
    })

    it('delay is always capped at 300000ms for any attempt number', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }),
          (attempt) => {
            const delay = computeRetryDelay(attempt)
            return delay <= 300_000 && delay >= 15_000
          }
        ),
        { numRuns: 100 }
      )
    })

    it('no more than 5 retry attempts are made before marking feed as unreachable', async () => {
      resetMockState()
      mockState.defaultConnectBehavior = 'fail'

      const manager = new CameraConnectionManager()
      const feed = makeFeed()
      await manager.connect(feed)

      // Advance through all retry attempts
      for (let i = 0; i < MAX_RETRY_ATTEMPTS; i++) {
        await vi.advanceTimersByTimeAsync(300_001)
      }

      expect(manager.getStatus('feed-1')).toBe('unreachable')
      expect(MAX_RETRY_ATTEMPTS).toBe(5)
      manager.disconnectAll()
    })
  })

  describe('Property 5: Connection state change emits correct event', () => {
    /**
     * **Validates: Requirements 2.4**
     *
     * When a feed's connection status changes, the 'statusChange' event is emitted
     * with the correct feedId, new status, and previous status.
     */
    it('emits statusChange with correct feedId and status on successful connection', async () => {
      // Generate feed IDs upfront, then test each one sequentially
      const feedIds = fc.sample(
        fc.stringMatching(/^[a-z][a-z0-9]{1,15}$/),
        100
      )

      for (const feedId of feedIds) {
        resetMockState()
        mockState.defaultConnectBehavior = 'succeed'

        const manager = new CameraConnectionManager()
        const events: ConnectionStatusChangeEvent[] = []
        manager.on('statusChange', (e: ConnectionStatusChangeEvent) => events.push(e))

        const feed = makeFeed({ id: feedId })
        await manager.connect(feed)

        // Should have emitted: disconnected → reconnecting, reconnecting → connected
        expect(events).toHaveLength(2)

        // First event: transition to reconnecting
        expect(events[0].feedId).toBe(feedId)
        expect(events[0].status).toBe('reconnecting')
        expect(events[0].previousStatus).toBe('disconnected')

        // Second event: transition to connected
        expect(events[1].feedId).toBe(feedId)
        expect(events[1].status).toBe('connected')
        expect(events[1].previousStatus).toBe('reconnecting')

        manager.disconnectAll()
      }
    })

    it('emits statusChange with correct feedId on connection failure', async () => {
      const feedIds = fc.sample(
        fc.stringMatching(/^[a-z][a-z0-9]{1,15}$/),
        100
      )

      for (const feedId of feedIds) {
        resetMockState()
        mockState.defaultConnectBehavior = 'fail'

        const manager = new CameraConnectionManager()
        const events: ConnectionStatusChangeEvent[] = []
        manager.on('statusChange', (e: ConnectionStatusChangeEvent) => events.push(e))

        const feed = makeFeed({ id: feedId })
        await manager.connect(feed)

        // Should have emitted: disconnected → reconnecting (stays reconnecting due to retry scheduling)
        expect(events.length).toBeGreaterThanOrEqual(1)
        expect(events[0].feedId).toBe(feedId)
        expect(events[0].status).toBe('reconnecting')
        expect(events[0].previousStatus).toBe('disconnected')

        manager.disconnectAll()
      }
    })
  })

  describe('Property 6: Connection failure isolation', () => {
    /**
     * **Validates: Requirements 2.5, 2.6**
     *
     * When one feed's connection fails, other feeds' connection states remain unchanged.
     */
    it('failing feed does not affect other connected feeds', async () => {
      const numFeedsArr = fc.sample(fc.integer({ min: 2, max: 5 }), 100)

      for (const numFeeds of numFeedsArr) {
        resetMockState()
        mockState.defaultConnectBehavior = 'succeed'

        const manager = new CameraConnectionManager()

        // Connect all feeds successfully
        for (let i = 0; i < numFeeds; i++) {
          const feed = makeFeed({
            id: `feed-${i}`,
            label: `Player ${i}`,
            obsAddress: `ws://192.168.1.${10 + i}:4455`,
          })
          await manager.connect(feed)
        }

        // Verify all are connected
        for (let i = 0; i < numFeeds; i++) {
          expect(manager.isConnected(`feed-${i}`)).toBe(true)
        }

        // Pick the last feed to fail — simulate its connection closing
        const failIndex = numFeeds - 1
        const failInstance = mockState.instances[failIndex]
        failInstance.simulateClose()

        // The failed feed should no longer be connected
        expect(manager.getStatus(`feed-${failIndex}`)).not.toBe('connected')

        // All other feeds should remain connected
        for (let i = 0; i < numFeeds - 1; i++) {
          expect(manager.isConnected(`feed-${i}`)).toBe(true)
          expect(manager.getStatus(`feed-${i}`)).toBe('connected')
        }

        manager.disconnectAll()
      }
    })

    it('initial connection failure of one feed does not affect others', async () => {
      const params = fc.sample(
        fc.record({
          numFeeds: fc.integer({ min: 2, max: 5 }),
          failIndexRaw: fc.integer({ min: 0, max: 4 }),
        }),
        100
      )

      for (const { numFeeds, failIndexRaw } of params) {
        const failIndex = failIndexRaw % numFeeds
        resetMockState()
        mockState.defaultConnectBehavior = 'succeed'

        const manager = new CameraConnectionManager()

        // Connect feeds, making the failIndex one fail
        for (let i = 0; i < numFeeds; i++) {
          if (i === failIndex) {
            // Set the next instance (about to be created) to fail
            mockState.connectBehaviorByIndex.set(mockState.instances.length, 'fail')
          }
          const feed = makeFeed({
            id: `feed-${i}`,
            label: `Player ${i}`,
            obsAddress: `ws://192.168.1.${10 + i}:4455`,
          })
          await manager.connect(feed)
        }

        // The failed feed should be in reconnecting state
        expect(manager.getStatus(`feed-${failIndex}`)).toBe('reconnecting')

        // All other feeds should be connected
        for (let i = 0; i < numFeeds; i++) {
          if (i !== failIndex) {
            expect(manager.isConnected(`feed-${i}`)).toBe(true)
            expect(manager.getStatus(`feed-${i}`)).toBe('connected')
          }
        }

        manager.disconnectAll()
      }
    })
  })
})
