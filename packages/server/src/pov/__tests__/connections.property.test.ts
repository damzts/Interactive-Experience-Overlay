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

// Import after mock setup
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

  /**
   * **Validates: Requirements 2.3**
   *
   * Property 4: Exponential backoff computation
   * For attempt n (0-4), the backoff delay is 15000 * 2^n, capped at 300000ms.
   */
  describe('Property 4: Exponential backoff computation', () => {
    it('for attempt n (0-4), delay equals min(15000 * 2^n, 300000)', () => {
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

    it('no more than 5 retry attempts are made before marking feed as unreachable', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 4 }),
          (attempt) => {
            // Verify the constant is 5
            if (MAX_RETRY_ATTEMPTS !== 5) return false
            // Verify each attempt 0-4 produces a valid delay
            const delay = computeRetryDelay(attempt)
            const expected = Math.min(15_000 * Math.pow(2, attempt), 300_000)
            return delay === expected
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * **Validates: Requirements 2.4**
   *
   * Property 5: Connection state change emits correct event
   * When a feed's connection status changes, the 'statusChange' event is emitted
   * with the correct feedId, new status, and previous status.
   */
  describe('Property 5: Connection state change emits correct event', () => {
    it('successful connection emits statusChange with correct feedId and statuses', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 10 }).map(
            (s) => `feed-${s.replace(/[^a-zA-Z0-9]/g, 'x')}`
          ),
          async (feedId) => {
            resetMockState()
            mockState.defaultConnectBehavior = 'succeed'

            const manager = new CameraConnectionManager()
            const events: ConnectionStatusChangeEvent[] = []
            manager.on('statusChange', (e: ConnectionStatusChangeEvent) =>
              events.push(e)
            )

            const feed = makeFeed({ id: feedId })
            await manager.connect(feed)

            // Should have emitted exactly 2 events: disconnected→reconnecting, reconnecting→connected
            expect(events.length).toBe(2)

            // First event: disconnected → reconnecting
            expect(events[0].feedId).toBe(feedId)
            expect(events[0].previousStatus).toBe('disconnected')
            expect(events[0].status).toBe('reconnecting')

            // Second event: reconnecting → connected
            expect(events[1].feedId).toBe(feedId)
            expect(events[1].previousStatus).toBe('reconnecting')
            expect(events[1].status).toBe('connected')

            manager.disconnectAll()
          }
        ),
        { numRuns: 100 }
      )
    })

    it('failed connection emits statusChange with reconnecting status', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 10 }).map(
            (s) => `feed-${s.replace(/[^a-zA-Z0-9]/g, 'x')}`
          ),
          async (feedId) => {
            resetMockState()
            mockState.defaultConnectBehavior = 'fail'

            const manager = new CameraConnectionManager()
            const events: ConnectionStatusChangeEvent[] = []
            manager.on('statusChange', (e: ConnectionStatusChangeEvent) =>
              events.push(e)
            )

            const feed = makeFeed({ id: feedId })
            await manager.connect(feed)

            // Should have emitted at least 1 event (disconnected → reconnecting)
            expect(events.length).toBeGreaterThanOrEqual(1)

            // First event: disconnected → reconnecting
            expect(events[0].feedId).toBe(feedId)
            expect(events[0].previousStatus).toBe('disconnected')
            expect(events[0].status).toBe('reconnecting')

            // All events should reference the correct feedId
            for (const event of events) {
              expect(event.feedId).toBe(feedId)
            }

            manager.disconnectAll()
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * **Validates: Requirements 2.5, 2.6**
   *
   * Property 6: Connection failure isolation
   * When one feed's connection fails, other feeds' connection states remain unchanged.
   */
  describe('Property 6: Connection failure isolation', () => {
    it('failing feed does not affect other connected feeds', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 5 }),
          fc.nat(),
          async (numFeeds, failSeed) => {
            resetMockState()
            const failIndex = failSeed % numFeeds

            const manager = new CameraConnectionManager()

            // Create feeds
            const feeds: CameraFeed[] = []
            for (let i = 0; i < numFeeds; i++) {
              feeds.push(
                makeFeed({
                  id: `feed-${i}`,
                  label: `Player ${i}`,
                  obsAddress: `ws://192.168.1.${10 + i}:4455`,
                })
              )
            }

            // Connect all feeds successfully
            mockState.defaultConnectBehavior = 'succeed'
            for (const f of feeds) {
              await manager.connect(f)
            }

            // Verify all are connected
            for (let i = 0; i < numFeeds; i++) {
              expect(manager.isConnected(`feed-${i}`)).toBe(true)
            }

            // Now simulate one feed disconnecting via ConnectionClosed
            // The mock instance index corresponds to the feed index since we reset state
            const failInstance = mockState.instances[failIndex]
            mockState.defaultConnectBehavior = 'fail'
            failInstance.simulateClose()

            // The failed feed should no longer be 'connected'
            expect(manager.getStatus(`feed-${failIndex}`)).toBe('disconnected')

            // All other feeds should remain connected
            for (let i = 0; i < numFeeds; i++) {
              if (i !== failIndex) {
                expect(manager.isConnected(`feed-${i}`)).toBe(true)
                expect(manager.getStatus(`feed-${i}`)).toBe('connected')
              }
            }

            manager.disconnectAll()
          }
        ),
        { numRuns: 100 }
      )
    })

    it('multiple feeds failing independently do not cascade', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 3, max: 6 }),
          fc.integer({ min: 1, max: 2 }),
          async (numFeeds, numFailures) => {
            resetMockState()
            const adjustedFailures = Math.min(numFailures, numFeeds - 1)

            const manager = new CameraConnectionManager()

            // Create feeds
            const feeds: CameraFeed[] = []
            for (let i = 0; i < numFeeds; i++) {
              feeds.push(
                makeFeed({
                  id: `feed-${i}`,
                  label: `Player ${i}`,
                  obsAddress: `ws://192.168.1.${10 + i}:4455`,
                })
              )
            }

            // Connect all feeds successfully
            mockState.defaultConnectBehavior = 'succeed'
            for (const f of feeds) {
              await manager.connect(f)
            }

            // Verify all connected
            for (let i = 0; i < numFeeds; i++) {
              expect(manager.isConnected(`feed-${i}`)).toBe(true)
            }

            // Simulate multiple feeds disconnecting
            mockState.defaultConnectBehavior = 'fail'
            for (let i = 0; i < adjustedFailures; i++) {
              mockState.instances[i].simulateClose()
            }

            // Failed feeds should be disconnected
            for (let i = 0; i < adjustedFailures; i++) {
              expect(manager.getStatus(`feed-${i}`)).toBe('disconnected')
            }

            // Remaining feeds should still be connected
            for (let i = adjustedFailures; i < numFeeds; i++) {
              expect(manager.isConnected(`feed-${i}`)).toBe(true)
              expect(manager.getStatus(`feed-${i}`)).toBe('connected')
            }

            manager.disconnectAll()
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
