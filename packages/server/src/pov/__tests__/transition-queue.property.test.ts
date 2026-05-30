import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'
import { TransitionQueue, MAX_QUEUE_DEPTH } from '../transition-queue.js'

// ── Mock OBS WebSocket ───────────────────────────────────────────────────────

function createMockObs() {
  const listeners = new Map<string, Function[]>()

  return {
    call: vi.fn(async () => ({})),
    on: vi.fn((event: string, handler: Function) => {
      if (!listeners.has(event)) listeners.set(event, [])
      listeners.get(event)!.push(handler)
    }),
    off: vi.fn((event: string, handler: Function) => {
      const handlers = listeners.get(event) || []
      const idx = handlers.indexOf(handler)
      if (idx >= 0) handlers.splice(idx, 1)
    }),
  } as any
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Generate a valid feed ID string */
const feedIdArb = fc.stringMatching(/^[a-z][a-z0-9-]{2,20}$/)

/**
 * Generate a list of feed IDs with a guaranteed minimum count.
 * Returns unique feed IDs.
 */
function feedIdListArb(minLength: number, maxLength: number) {
  return fc.uniqueArray(feedIdArb, { minLength, maxLength })
}

// ── Property Tests ───────────────────────────────────────────────────────────

describe('TransitionQueue Property Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  /**
   * **Validates: Requirements 8.3, 8.5**
   *
   * Property 22: Transition queue respects max depth
   *
   * The queue never holds more than 5 items; when a 6th is enqueued,
   * the oldest is discarded.
   */
  describe('Property 22: Transition queue respects max depth', () => {
    it('queue never exceeds maxDepth regardless of how many items are enqueued', async () => {
      await fc.assert(
        fc.asyncProperty(
          feedIdListArb(1, 30),
          async (feedIds) => {
            const mockObs = createMockObs()
            const connectedFeeds = new Set(feedIds)

            const queue = new TransitionQueue({
              outputObs: mockObs,
              isFeedConnected: (id) => connectedFeeds.has(id),
              // Use fade to keep transition in progress so items accumulate in queue
              transitionConfig: { type: 'fade', durationMs: 500 },
            })

            // Enqueue the first item to start a transition (blocks processing)
            if (feedIds.length > 0) {
              queue.enqueue(feedIds[0])
              await vi.advanceTimersByTimeAsync(0)
            }

            // Enqueue remaining items while transition is in progress
            for (let i = 1; i < feedIds.length; i++) {
              queue.enqueue(feedIds[i])
            }

            // The queue (excluding the item being processed) should never exceed maxDepth
            const currentQueue = queue.getQueue()
            expect(currentQueue.length).toBeLessThanOrEqual(MAX_QUEUE_DEPTH)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('when a 6th item is enqueued, the oldest is discarded and the new one is appended', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate exactly 6+ unique feed IDs to overflow the queue
          feedIdListArb(7, 15),
          async (feedIds) => {
            const mockObs = createMockObs()
            const connectedFeeds = new Set(feedIds)

            const queue = new TransitionQueue({
              outputObs: mockObs,
              isFeedConnected: (id) => connectedFeeds.has(id),
              transitionConfig: { type: 'fade', durationMs: 500 },
            })

            // First item starts processing (blocks the queue)
            queue.enqueue(feedIds[0])
            await vi.advanceTimersByTimeAsync(0)

            // Enqueue exactly MAX_QUEUE_DEPTH items to fill the queue
            for (let i = 1; i <= MAX_QUEUE_DEPTH; i++) {
              queue.enqueue(feedIds[i])
            }

            // Queue should be full
            expect(queue.getQueue().length).toBe(MAX_QUEUE_DEPTH)
            const oldestBeforeOverflow = queue.getQueue()[0].feedId

            // Enqueue one more (the 6th queued item) — should discard oldest
            const overflowFeedId = feedIds[MAX_QUEUE_DEPTH + 1]
            queue.enqueue(overflowFeedId)

            const currentQueue = queue.getQueue()

            // Queue still at max depth
            expect(currentQueue.length).toBe(MAX_QUEUE_DEPTH)

            // The oldest item should have been discarded
            expect(currentQueue[0].feedId).not.toBe(oldestBeforeOverflow)

            // The new item should be at the end
            expect(currentQueue[currentQueue.length - 1].feedId).toBe(overflowFeedId)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * **Validates: Requirements 8.7**
   *
   * Property 23: Queued requests for disconnected feeds are discarded
   *
   * When a feed disconnects, any queued transitions referencing that feed
   * are removed from the queue (discarded during processing).
   */
  describe('Property 23: Queued requests for disconnected feeds are discarded', () => {
    it('disconnected feed requests are skipped during queue processing', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate feed IDs: some will be disconnected
          feedIdListArb(3, 10),
          // Choose a random subset to disconnect (indices)
          fc.gen().map((gen) => gen(fc.nat, { max: 100 })),
          async (feedIds, disconnectSeed) => {
            fc.pre(feedIds.length >= 3)

            const mockObs = createMockObs()
            const connectedFeeds = new Set(feedIds)

            const queue = new TransitionQueue({
              outputObs: mockObs,
              isFeedConnected: (id) => connectedFeeds.has(id),
              transitionConfig: { type: 'fade', durationMs: 500 },
            })

            // First item starts processing
            queue.enqueue(feedIds[0])
            await vi.advanceTimersByTimeAsync(0)

            // Enqueue remaining items
            for (let i = 1; i < feedIds.length; i++) {
              queue.enqueue(feedIds[i])
            }

            // Disconnect some feeds (not the first one which is already processing)
            const disconnectedIds: string[] = []
            for (let i = 1; i < feedIds.length; i++) {
              // Use the seed to deterministically decide which feeds to disconnect
              if ((disconnectSeed + i) % 3 === 0) {
                connectedFeeds.delete(feedIds[i])
                disconnectedIds.push(feedIds[i])
              }
            }

            // Complete the first transition so the queue starts processing
            // Simulate transition end by advancing past timeout
            await vi.advanceTimersByTimeAsync(10_001)

            // Process remaining items
            await vi.advanceTimersByTimeAsync(10_001 * feedIds.length)

            // Verify: SetCurrentProgramScene should NOT have been called
            // for any disconnected feed
            const programSceneCalls = mockObs.call.mock.calls.filter(
              (c: any[]) => c[0] === 'SetCurrentProgramScene'
            )
            const processedScenes = programSceneCalls.map(
              (c: any[]) => c[1]?.sceneName
            )

            for (const disconnectedId of disconnectedIds) {
              expect(processedScenes).not.toContain(disconnectedId)
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('connected feeds in the queue are still processed after disconnected ones are discarded', async () => {
      await fc.assert(
        fc.asyncProperty(
          feedIdListArb(4, 8),
          async (feedIds) => {
            fc.pre(feedIds.length >= 4)

            const mockObs = createMockObs()
            const connectedFeeds = new Set(feedIds)

            const queue = new TransitionQueue({
              outputObs: mockObs,
              isFeedConnected: (id) => connectedFeeds.has(id),
              // Use cut for immediate processing
              transitionConfig: { type: 'cut', durationMs: 0 },
            })

            // Enqueue all feeds — first one processes immediately
            queue.enqueue(feedIds[0])
            await vi.advanceTimersByTimeAsync(0)

            // Disconnect the second feed before it gets processed
            connectedFeeds.delete(feedIds[1])

            // Enqueue remaining (including the disconnected one)
            queue.enqueue(feedIds[1]) // disconnected
            queue.enqueue(feedIds[2]) // connected
            queue.enqueue(feedIds[3]) // connected

            // Process all
            await vi.advanceTimersByTimeAsync(0)

            // Verify: the connected feeds after the disconnected one were processed
            const programSceneCalls = mockObs.call.mock.calls.filter(
              (c: any[]) => c[0] === 'SetCurrentProgramScene'
            )
            const processedScenes = programSceneCalls.map(
              (c: any[]) => c[1]?.sceneName
            )

            // First feed was processed
            expect(processedScenes).toContain(feedIds[0])
            // Disconnected feed was NOT processed
            expect(processedScenes).not.toContain(feedIds[1])
            // Connected feeds after the disconnected one were processed
            expect(processedScenes).toContain(feedIds[2])
            expect(processedScenes).toContain(feedIds[3])
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
