import { EventEmitter } from 'events'
import type OBSWebSocket from 'obs-websocket-js'
import type { TransitionConfig, QueuedSwitch } from '@ieom/shared'
import type { POVErrorPayload } from '@ieom/shared'

// ── Constants ────────────────────────────────────────────────────────────────

/** Maximum number of queued switch requests */
export const MAX_QUEUE_DEPTH = 5

/** Timeout for waiting on a transition completion event (ms) */
export const TRANSITION_TIMEOUT_MS = 10_000

/** Delay before retrying a failed transition command (ms) */
export const RETRY_DELAY_MS = 500

// ── Types ────────────────────────────────────────────────────────────────────

export interface TransitionQueueEvents {
  error: [payload: POVErrorPayload]
}

/**
 * Function that checks whether a given feed is currently connected.
 * Used to discard queued requests referencing disconnected feeds.
 */
export type FeedConnectedChecker = (feedId: string) => boolean

/**
 * Options for constructing a TransitionQueue.
 */
export interface TransitionQueueOptions {
  /** The OBS WebSocket connection to the output/program OBS instance */
  outputObs: OBSWebSocket
  /** Function to check if a feed is still connected */
  isFeedConnected: FeedConnectedChecker
  /** Initial transition configuration */
  transitionConfig?: TransitionConfig
}

// ── TransitionQueue ──────────────────────────────────────────────────────────

/**
 * Manages OBS scene transition commands with queuing to prevent conflicts.
 *
 * Responsibilities:
 * - Queue switch requests (max depth 5, discard oldest when full)
 * - Execute transitions via SetCurrentProgramScene on the output OBS
 * - Wait for transition completion event or 10s timeout
 * - Retry once on failure (500ms delay); skip on second failure
 * - Discard queued requests for disconnected feeds
 * - Support cut (0ms) and fade (100-60000ms) transition types
 */
export class TransitionQueue extends EventEmitter {
  public readonly maxDepth: number = MAX_QUEUE_DEPTH

  private queue: QueuedSwitch[] = []
  private transitioning = false
  private config: TransitionConfig = { type: 'cut', durationMs: 0 }
  private outputObs: OBSWebSocket
  private isFeedConnected: FeedConnectedChecker

  constructor(options: TransitionQueueOptions) {
    super()
    this.outputObs = options.outputObs
    this.isFeedConnected = options.isFeedConnected
    if (options.transitionConfig) {
      this.config = { ...options.transitionConfig }
    }
  }

  /**
   * Enqueue a switch request for the given feed.
   * If the queue is at max depth, the oldest entry is discarded.
   * If no transition is in progress, processing starts immediately.
   */
  enqueue(feedId: string): void {
    // Enforce max depth — discard oldest when full
    if (this.queue.length >= this.maxDepth) {
      this.queue.shift()
    }

    const item: QueuedSwitch = {
      feedId,
      timestamp: Date.now(),
    }

    this.queue.push(item)

    // If not currently transitioning, start processing
    if (!this.transitioning) {
      void this.processNext()
    }
  }

  /**
   * Returns whether a transition is currently in progress.
   */
  isTransitioning(): boolean {
    return this.transitioning
  }

  /**
   * Update the transition configuration (type and duration).
   * Applied to subsequent transitions without restarting connections.
   */
  updateConfig(config: TransitionConfig): void {
    this.config = { ...config }
  }

  /**
   * Get the current queue contents (for testing/inspection).
   */
  getQueue(): QueuedSwitch[] {
    return [...this.queue]
  }

  /**
   * Get the current transition config.
   */
  getConfig(): TransitionConfig {
    return { ...this.config }
  }

  // ── Private Methods ──────────────────────────────────────────────────────

  /**
   * Process the next item in the queue.
   * Skips items referencing disconnected feeds.
   */
  private async processNext(): Promise<void> {
    // Find the next valid item (skip disconnected feeds)
    while (this.queue.length > 0) {
      const item = this.queue[0]

      // Discard if feed is disconnected (Requirement 8.7)
      if (!this.isFeedConnected(item.feedId)) {
        this.queue.shift()
        continue
      }

      // Valid item found — execute transition
      this.queue.shift()
      this.transitioning = true

      const success = await this.executeTransition(item)

      this.transitioning = false

      if (!success) {
        // Transition failed after retry — move to next item
        // (error already emitted in executeTransition)
      }

      // Continue processing remaining items
      continue
    }

    // Queue is empty
    this.transitioning = false
  }

  /**
   * Execute a single transition with retry logic.
   * - First attempt: execute the OBS command
   * - On failure: wait 500ms and retry once
   * - On second failure: skip, emit error, return false
   */
  private async executeTransition(item: QueuedSwitch): Promise<boolean> {
    // First attempt
    const firstResult = await this.attemptTransition(item.feedId)
    if (firstResult) {
      return true
    }

    // Wait 500ms before retry
    await this.delay(RETRY_DELAY_MS)

    // Check if feed is still connected before retry
    if (!this.isFeedConnected(item.feedId)) {
      return false
    }

    // Retry (second attempt)
    const retryResult = await this.attemptTransition(item.feedId)
    if (retryResult) {
      return true
    }

    // Both attempts failed — emit error
    const errorPayload: POVErrorPayload = {
      feedId: item.feedId,
      message: `Transition to feed ${item.feedId} failed after retry`,
      code: 'transition_failed',
    }
    this.emit('error', errorPayload)

    return false
  }

  /**
   * Attempt a single transition command to the output OBS.
   * Sets the transition type/duration and then switches the program scene.
   * Waits for the transition completion event or a 10s timeout.
   */
  private async attemptTransition(feedId: string): Promise<boolean> {
    try {
      // Get the scene name for this feed — we use feedId as the scene name
      // In the real system, the scene name is looked up from the CameraRegistry
      // but the TransitionQueue receives the feedId which maps to a scene
      const sceneName = feedId

      // Set transition override if using fade
      if (this.config.type === 'fade') {
        await this.outputObs.call('SetCurrentSceneTransition' as any, {
          transitionName: 'Fade',
        })
        await this.outputObs.call('SetCurrentSceneTransitionDuration' as any, {
          transitionDuration: this.config.durationMs,
        })
      } else {
        // Cut transition — set to Cut with 0ms
        await this.outputObs.call('SetCurrentSceneTransition' as any, {
          transitionName: 'Cut',
        })
      }

      // Execute the scene switch
      await this.outputObs.call('SetCurrentProgramScene' as any, {
        sceneName,
      })

      // Wait for transition completion or timeout
      await this.waitForTransitionComplete()

      return true
    } catch {
      return false
    }
  }

  /**
   * Wait for the OBS transition to complete.
   * Resolves when SceneTransitionEnded event fires or after 10s timeout.
   */
  private waitForTransitionComplete(): Promise<void> {
    // For cut transitions (0ms), resolve immediately
    if (this.config.type === 'cut') {
      return Promise.resolve()
    }

    return new Promise<void>((resolve) => {
      let resolved = false

      const timeoutHandle = setTimeout(() => {
        if (!resolved) {
          resolved = true
          cleanup()
          resolve()
        }
      }, TRANSITION_TIMEOUT_MS)

      const handler = () => {
        if (!resolved) {
          resolved = true
          clearTimeout(timeoutHandle)
          cleanup()
          resolve()
        }
      }

      const cleanup = () => {
        try {
          this.outputObs.off('SceneTransitionEnded' as any, handler)
        } catch {
          // Ignore cleanup errors
        }
      }

      this.outputObs.on('SceneTransitionEnded' as any, handler)
    })
  }

  /**
   * Simple delay utility.
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
