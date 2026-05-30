import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { POVErrorPayload } from '@ieom/shared'
import {
  TransitionQueue,
  MAX_QUEUE_DEPTH,
  TRANSITION_TIMEOUT_MS,
  RETRY_DELAY_MS,
} from '../transition-queue.js'

// ── Mock OBS WebSocket ───────────────────────────────────────────────────────

function createMockObs(options: { failCall?: boolean; failAfterAttempts?: number } = {}) {
  let attemptCount = 0
  const listeners = new Map<string, Function[]>()

  const obs = {
    call: vi.fn(async (command: string, params?: any) => {
      if (options.failCall) {
        attemptCount++
        // If failAfterAttempts is set, succeed after that many total call failures
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
    // Helper to simulate transition end event
    _emitTransitionEnd() {
      const handlers = listeners.get('SceneTransitionEnded') || []
      for (const h of handlers) h()
    },
    _listeners: listeners,
    _getAttemptCount() { return attemptCount },
  }

  return obs as any
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function createConnectedChecker(connectedFeeds: Set<string>) {
  return (feedId: string) => connectedFeeds.has(feedId)
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('TransitionQueue', () => {
  let mockObs: ReturnType<typeof createMockObs>
  let connectedFeeds: Set<string>
  let queue: TransitionQueue

  beforeEach(() => {
    vi.useFakeTimers()
    mockObs = createMockObs()
    connectedFeeds = new Set(['feed-1', 'feed-2', 'feed-3', 'feed-4', 'feed-5', 'feed-6'])
    queue = new TransitionQueue({
      outputObs: mockObs,
      isFeedConnected: createConnectedChecker(connectedFeeds),
      transitionConfig: { type: 'cut', durationMs: 0 },
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('enqueue', () => {
    it('processes a single enqueued item immediately when not transitioning', async () => {
      queue.enqueue('feed-1')
      await vi.advanceTimersByTimeAsync(0)

      expect(mockObs.call).toHaveBeenCalledWith('SetCurrentSceneTransition', {
        transitionName: 'Cut',
      })
      expect(mockObs.call).toHaveBeenCalledWith('SetCurrentProgramScene', {
        sceneName: 'feed-1',
      })
    })

    it('queues items when a transition is in progress', async () => {
      // Use fade to create a transition that takes time
      queue.updateConfig({ type: 'fade', durationMs: 500 })

      queue.enqueue('feed-1')
      // Don't await — transition is in progress
      await vi.advanceTimersByTimeAsync(0)

      queue.enqueue('feed-2')

      // feed-2 should be in the queue
      expect(queue.getQueue()).toHaveLength(1)
      expect(queue.getQueue()[0].feedId).toBe('feed-2')
    })

    it('discards oldest when queue is at max depth', async () => {
      // Use fade to keep transition in progress
      queue.updateConfig({ type: 'fade', durationMs: 500 })

      queue.enqueue('feed-1') // This starts processing immediately
      await vi.advanceTimersByTimeAsync(0)

      // Fill the queue to max depth
      for (let i = 2; i <= MAX_QUEUE_DEPTH + 1; i++) {
        queue.enqueue(`feed-${i}`)
      }

      // Now add one more — should discard the oldest queued item
      queue.enqueue('feed-overflow')

      const items = queue.getQueue()
      expect(items.length).toBeLessThanOrEqual(MAX_QUEUE_DEPTH)
      // The oldest queued item (feed-2) should have been discarded
      expect(items[items.length - 1].feedId).toBe('feed-overflow')
      expect(items.find((i) => i.feedId === 'feed-2')).toBeUndefined()
    })
  })

  describe('transition execution', () => {
    it('uses Cut transition type for cut config', async () => {
      queue.updateConfig({ type: 'cut', durationMs: 0 })
      queue.enqueue('feed-1')
      await vi.advanceTimersByTimeAsync(0)

      expect(mockObs.call).toHaveBeenCalledWith('SetCurrentSceneTransition', {
        transitionName: 'Cut',
      })
      expect(mockObs.call).toHaveBeenCalledWith('SetCurrentProgramScene', {
        sceneName: 'feed-1',
      })
    })

    it('uses Fade transition type with duration for fade config', async () => {
      queue.updateConfig({ type: 'fade', durationMs: 1000 })
      queue.enqueue('feed-1')
      await vi.advanceTimersByTimeAsync(0)

      expect(mockObs.call).toHaveBeenCalledWith('SetCurrentSceneTransition', {
        transitionName: 'Fade',
      })
      expect(mockObs.call).toHaveBeenCalledWith('SetCurrentSceneTransitionDuration', {
        transitionDuration: 1000,
      })
      expect(mockObs.call).toHaveBeenCalledWith('SetCurrentProgramScene', {
        sceneName: 'feed-1',
      })
    })

    it('resolves immediately for cut transitions (no wait)', async () => {
      queue.updateConfig({ type: 'cut', durationMs: 0 })
      queue.enqueue('feed-1')
      await vi.advanceTimersByTimeAsync(0)

      expect(queue.isTransitioning()).toBe(false)
    })

    it('waits for SceneTransitionEnded event for fade transitions', async () => {
      queue.updateConfig({ type: 'fade', durationMs: 500 })
      queue.enqueue('feed-1')
      await vi.advanceTimersByTimeAsync(0)

      // Should be transitioning (waiting for event)
      expect(queue.isTransitioning()).toBe(true)

      // Simulate transition end
      mockObs._emitTransitionEnd()
      await vi.advanceTimersByTimeAsync(0)

      expect(queue.isTransitioning()).toBe(false)
    })

    it('times out after 10s if no transition completion event', async () => {
      queue.updateConfig({ type: 'fade', durationMs: 500 })
      queue.enqueue('feed-1')
      await vi.advanceTimersByTimeAsync(0)

      expect(queue.isTransitioning()).toBe(true)

      // Advance past timeout
      await vi.advanceTimersByTimeAsync(TRANSITION_TIMEOUT_MS + 1)

      expect(queue.isTransitioning()).toBe(false)
    })

    it('processes next item after current transition completes', async () => {
      queue.updateConfig({ type: 'fade', durationMs: 500 })

      queue.enqueue('feed-1')
      await vi.advanceTimersByTimeAsync(0)

      queue.enqueue('feed-2')

      // Complete first transition
      mockObs._emitTransitionEnd()
      await vi.advanceTimersByTimeAsync(0)

      // Second transition should have started
      expect(mockObs.call).toHaveBeenCalledWith('SetCurrentProgramScene', {
        sceneName: 'feed-2',
      })
    })
  })

  describe('retry logic', () => {
    it('retries once after 500ms on first failure', async () => {
      const failObs = createMockObs({ failCall: true, failAfterAttempts: 1 })
      const retryQueue = new TransitionQueue({
        outputObs: failObs,
        isFeedConnected: createConnectedChecker(connectedFeeds),
        transitionConfig: { type: 'cut', durationMs: 0 },
      })

      retryQueue.enqueue('feed-1')
      await vi.advanceTimersByTimeAsync(0)

      // First attempt fails on the first call (SetCurrentSceneTransition)
      // call count should be 1 after first attempt
      const callsAfterFirst = failObs.call.mock.calls.length
      expect(callsAfterFirst).toBe(1)

      // Wait 500ms for retry
      await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS)

      // After retry, more calls should have been made (retry succeeds after failAfterAttempts=1)
      const callsAfterRetry = failObs.call.mock.calls.length
      expect(callsAfterRetry).toBeGreaterThan(callsAfterFirst)
    })

    it('emits pov:error with transition_failed code on second failure', async () => {
      const failObs = createMockObs({ failCall: true })
      const retryQueue = new TransitionQueue({
        outputObs: failObs,
        isFeedConnected: createConnectedChecker(connectedFeeds),
        transitionConfig: { type: 'cut', durationMs: 0 },
      })

      const errors: POVErrorPayload[] = []
      retryQueue.on('error', (payload: POVErrorPayload) => errors.push(payload))

      retryQueue.enqueue('feed-1')
      await vi.advanceTimersByTimeAsync(0)

      // Wait for retry delay
      await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS)

      expect(errors).toHaveLength(1)
      expect(errors[0].code).toBe('transition_failed')
      expect(errors[0].feedId).toBe('feed-1')
    })

    it('skips transition and dequeues next on second failure', async () => {
      const failObs = createMockObs({ failCall: true })
      const retryQueue = new TransitionQueue({
        outputObs: failObs,
        isFeedConnected: createConnectedChecker(connectedFeeds),
        transitionConfig: { type: 'cut', durationMs: 0 },
      })

      // Must add error listener to prevent unhandled error
      const errors: POVErrorPayload[] = []
      retryQueue.on('error', (payload: POVErrorPayload) => errors.push(payload))

      retryQueue.enqueue('feed-1')
      retryQueue.enqueue('feed-2')
      await vi.advanceTimersByTimeAsync(0)

      // feed-1 first attempt fails, wait for retry
      await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS)

      // feed-1 retry also fails, error emitted, moves to feed-2
      // feed-2 first attempt fails, wait for its retry
      await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS)

      // Both feeds should have had errors emitted
      expect(errors).toHaveLength(2)
      expect(errors[0].feedId).toBe('feed-1')
      expect(errors[1].feedId).toBe('feed-2')

      // Total call attempts: 2 for feed-1 + 2 for feed-2 = 4
      expect(failObs.call.mock.calls.length).toBe(4)
    })
  })

  describe('disconnected feed handling', () => {
    it('discards queued requests for disconnected feeds', async () => {
      queue.updateConfig({ type: 'fade', durationMs: 500 })

      queue.enqueue('feed-1')
      await vi.advanceTimersByTimeAsync(0)

      // Queue feed-2, then disconnect it
      queue.enqueue('feed-2')
      queue.enqueue('feed-3')
      connectedFeeds.delete('feed-2')

      // Complete first transition
      mockObs._emitTransitionEnd()
      await vi.advanceTimersByTimeAsync(0)

      // feed-2 should be skipped, feed-3 should be processed
      const programSceneCalls = mockObs.call.mock.calls.filter(
        (c: any[]) => c[0] === 'SetCurrentProgramScene'
      )
      const sceneNames = programSceneCalls.map((c: any[]) => c[1].sceneName)
      expect(sceneNames).toContain('feed-1')
      expect(sceneNames).not.toContain('feed-2')
      expect(sceneNames).toContain('feed-3')
    })

    it('does not retry if feed disconnects between attempts', async () => {
      const failObs = createMockObs({ failCall: true, failAfterAttempts: 1 })
      const retryQueue = new TransitionQueue({
        outputObs: failObs,
        isFeedConnected: createConnectedChecker(connectedFeeds),
        transitionConfig: { type: 'cut', durationMs: 0 },
      })

      // Add error listener to prevent unhandled error
      retryQueue.on('error', () => {})

      retryQueue.enqueue('feed-1')
      await vi.advanceTimersByTimeAsync(0)

      // First attempt fails (1 call made)
      const callsAfterFirst = failObs.call.mock.calls.length
      expect(callsAfterFirst).toBe(1)

      // Disconnect feed-1 before retry fires
      connectedFeeds.delete('feed-1')

      await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS)

      // Should NOT have made additional calls since feed is disconnected
      expect(failObs.call.mock.calls.length).toBe(callsAfterFirst)
    })
  })

  describe('updateConfig', () => {
    it('applies new transition config to subsequent transitions', async () => {
      queue.updateConfig({ type: 'fade', durationMs: 2000 })

      queue.enqueue('feed-1')
      await vi.advanceTimersByTimeAsync(0)

      expect(mockObs.call).toHaveBeenCalledWith('SetCurrentSceneTransitionDuration', {
        transitionDuration: 2000,
      })
    })

    it('does not affect in-progress transitions', async () => {
      queue.updateConfig({ type: 'fade', durationMs: 500 })

      queue.enqueue('feed-1')
      await vi.advanceTimersByTimeAsync(0)

      // Update config while transitioning
      queue.updateConfig({ type: 'cut', durationMs: 0 })

      // The current transition should still be waiting for fade completion
      expect(queue.isTransitioning()).toBe(true)

      // Complete the fade transition
      mockObs._emitTransitionEnd()
      await vi.advanceTimersByTimeAsync(0)

      expect(queue.isTransitioning()).toBe(false)
    })
  })

  describe('isTransitioning', () => {
    it('returns false when queue is empty and no transition in progress', () => {
      expect(queue.isTransitioning()).toBe(false)
    })

    it('returns true during a fade transition', async () => {
      queue.updateConfig({ type: 'fade', durationMs: 500 })
      queue.enqueue('feed-1')
      await vi.advanceTimersByTimeAsync(0)

      expect(queue.isTransitioning()).toBe(true)
    })

    it('returns false after cut transition completes', async () => {
      queue.updateConfig({ type: 'cut', durationMs: 0 })
      queue.enqueue('feed-1')
      await vi.advanceTimersByTimeAsync(0)

      expect(queue.isTransitioning()).toBe(false)
    })
  })

  describe('max queue depth enforcement', () => {
    it('maintains at most 5 items in the queue', async () => {
      queue.updateConfig({ type: 'fade', durationMs: 500 })

      // Start a transition to block processing
      queue.enqueue('feed-1')
      await vi.advanceTimersByTimeAsync(0)

      // Add 7 more items
      for (let i = 2; i <= 8; i++) {
        queue.enqueue(`feed-${i}`)
      }

      // Queue should have at most MAX_QUEUE_DEPTH items
      expect(queue.getQueue().length).toBeLessThanOrEqual(MAX_QUEUE_DEPTH)
    })

    it('discards oldest item when adding to a full queue', async () => {
      queue.updateConfig({ type: 'fade', durationMs: 500 })

      // Start a transition to block processing
      queue.enqueue('feed-1')
      await vi.advanceTimersByTimeAsync(0)

      // Fill queue to max
      queue.enqueue('feed-a')
      queue.enqueue('feed-b')
      queue.enqueue('feed-c')
      queue.enqueue('feed-d')
      queue.enqueue('feed-e')

      // Queue is now full (5 items)
      expect(queue.getQueue().length).toBe(MAX_QUEUE_DEPTH)

      // Add one more — oldest (feed-a) should be discarded
      connectedFeeds.add('feed-new')
      queue.enqueue('feed-new')

      const items = queue.getQueue()
      expect(items.length).toBe(MAX_QUEUE_DEPTH)
      expect(items[0].feedId).toBe('feed-b')
      expect(items[items.length - 1].feedId).toBe('feed-new')
    })
  })
})
