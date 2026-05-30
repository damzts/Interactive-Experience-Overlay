import type OBSWebSocket from 'obs-websocket-js'
import type { CameraConnectionManager } from './connections.js'
import type { CameraRegistry } from './registry.js'

// ── Types ────────────────────────────────────────────────────────────────────

export interface AudioMonitorConfig {
  pollIntervalMs: number    // Default 100, min 50, max 1000
  rollingWindowMs: number   // Default 2000, min 500, max 10000
  dbFloor: number           // Default -60
  dbCeiling: number         // Default 0
  emitIntervalMs: number    // Default 500, min 100, max 5000
}

export type ScoresCallback = (scores: Map<string, number>) => void

// ── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: AudioMonitorConfig = {
  pollIntervalMs: 100,
  rollingWindowMs: 2000,
  dbFloor: -60,
  dbCeiling: 0,
  emitIntervalMs: 500,
}

/** Number of consecutive missed polls before zeroing the Activity Score */
const MISSED_POLL_THRESHOLD = 3

// ── Normalization ────────────────────────────────────────────────────────────

/**
 * Normalize a dB value to a 0-1 linear scale.
 *
 * Formula: clamp((dbValue - dbFloor) / (dbCeiling - dbFloor), 0, 1)
 *
 * - Values at or below dbFloor produce 0
 * - Values at or above dbCeiling produce 1
 * - Values between are linearly interpolated
 *
 * Exported separately for independent testing.
 */
export function normalizeDb(dbValue: number, dbFloor: number, dbCeiling: number): number {
  if (dbCeiling === dbFloor) return 0
  const normalized = (dbValue - dbFloor) / (dbCeiling - dbFloor)
  return Math.max(0, Math.min(1, normalized))
}

// ── Circular Buffer ──────────────────────────────────────────────────────────

/**
 * A fixed-size circular buffer for storing normalized audio readings.
 * Computes the arithmetic mean of all stored values.
 */
export class CircularBuffer {
  private buffer: number[]
  private head: number = 0
  private count: number = 0
  private sum: number = 0

  constructor(public readonly capacity: number) {
    this.buffer = new Array(capacity).fill(0)
  }

  /**
   * Push a new value into the buffer.
   * If the buffer is full, the oldest value is overwritten.
   */
  push(value: number): void {
    if (this.count === this.capacity) {
      // Overwrite oldest: subtract old value from sum
      this.sum -= this.buffer[this.head]
    } else {
      this.count++
    }

    this.buffer[this.head] = value
    this.sum += value
    this.head = (this.head + 1) % this.capacity
  }

  /**
   * Compute the arithmetic mean of all values in the buffer.
   * Returns 0 if the buffer is empty.
   */
  average(): number {
    if (this.count === 0) return 0
    return this.sum / this.count
  }

  /**
   * Reset the buffer, clearing all stored values.
   */
  reset(): void {
    this.buffer.fill(0)
    this.head = 0
    this.count = 0
    this.sum = 0
  }

  /**
   * Get the current number of values stored.
   */
  size(): number {
    return this.count
  }
}

// ── Per-Feed State ───────────────────────────────────────────────────────────

interface FeedAudioState {
  buffer: CircularBuffer
  consecutiveMisses: number
  wasZeroed: boolean // true if score was set to 0 due to missed polls
}

// ── AudioMonitor ─────────────────────────────────────────────────────────────

/**
 * AudioMonitor polls audio levels from all connected cameras and computes
 * Activity Scores using a rolling average of normalized dB readings.
 *
 * Dependencies:
 * - CameraConnectionManager: provides OBS WebSocket instances for each feed
 * - CameraRegistry: provides the list of connected feeds
 *
 * Behavior:
 * - Polls GetInputVolumeMeter on each connected OBS instance at configurable interval
 * - Normalizes dB values to 0-1 scale
 * - Maintains a circular buffer per feed for rolling average computation
 * - Tracks consecutive missed polls; zeros score after 3 misses
 * - On data resumption, resets buffer to compute from new readings only
 * - Emits aggregated scores to registered callbacks at configurable rate
 */
export class AudioMonitor {
  private config: AudioMonitorConfig
  private feedStates: Map<string, FeedAudioState> = new Map()
  private scores: Map<string, number> = new Map()
  private callbacks: ScoresCallback[] = []

  private pollTimer: ReturnType<typeof setInterval> | null = null
  private emitTimer: ReturnType<typeof setInterval> | null = null
  private running: boolean = false

  constructor(
    private connectionManager: CameraConnectionManager,
    private registry: CameraRegistry,
  ) {
    this.config = { ...DEFAULT_CONFIG }
  }

  /**
   * Start the audio monitoring loop with the given configuration.
   */
  start(config?: Partial<AudioMonitorConfig>): void {
    if (this.running) {
      this.stop()
    }

    if (config) {
      this.updateConfig(config)
    }

    this.running = true

    // Start polling loop
    this.pollTimer = setInterval(() => {
      this.pollAllFeeds()
    }, this.config.pollIntervalMs)

    // Start emit loop
    this.emitTimer = setInterval(() => {
      this.emitScores()
    }, this.config.emitIntervalMs)
  }

  /**
   * Stop the audio monitoring loop and clean up timers.
   */
  stop(): void {
    this.running = false

    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }

    if (this.emitTimer) {
      clearInterval(this.emitTimer)
      this.emitTimer = null
    }
  }

  /**
   * Update the monitor configuration. Clamps values to valid bounds.
   * If running, restarts the polling/emit loops with new intervals.
   */
  updateConfig(config: Partial<AudioMonitorConfig>): void {
    if (config.pollIntervalMs !== undefined) {
      this.config.pollIntervalMs = clampValue(config.pollIntervalMs, 50, 1000)
    }
    if (config.rollingWindowMs !== undefined) {
      this.config.rollingWindowMs = clampValue(config.rollingWindowMs, 500, 10000)
    }
    if (config.dbFloor !== undefined) {
      this.config.dbFloor = config.dbFloor
    }
    if (config.dbCeiling !== undefined) {
      this.config.dbCeiling = config.dbCeiling
    }
    if (config.emitIntervalMs !== undefined) {
      this.config.emitIntervalMs = clampValue(config.emitIntervalMs, 100, 5000)
    }

    // Rebuild buffers with new capacity if window or poll interval changed
    if (config.rollingWindowMs !== undefined || config.pollIntervalMs !== undefined) {
      this.rebuildBuffers()
    }

    // Restart timers if running and intervals changed
    if (this.running && (config.pollIntervalMs !== undefined || config.emitIntervalMs !== undefined)) {
      this.stop()
      this.running = true

      this.pollTimer = setInterval(() => {
        this.pollAllFeeds()
      }, this.config.pollIntervalMs)

      this.emitTimer = setInterval(() => {
        this.emitScores()
      }, this.config.emitIntervalMs)
    }
  }

  /**
   * Get the current Activity Scores for all tracked feeds.
   */
  getScores(): Map<string, number> {
    return new Map(this.scores)
  }

  /**
   * Register a callback to be invoked when scores are emitted.
   */
  onScoresUpdated(callback: ScoresCallback): void {
    this.callbacks.push(callback)
  }

  /**
   * Remove a previously registered callback.
   */
  offScoresUpdated(callback: ScoresCallback): void {
    const idx = this.callbacks.indexOf(callback)
    if (idx !== -1) {
      this.callbacks.splice(idx, 1)
    }
  }

  /**
   * Get the current configuration (for testing/inspection).
   */
  getConfig(): Readonly<AudioMonitorConfig> {
    return { ...this.config }
  }

  // ── Private Methods ──────────────────────────────────────────────────────

  /**
   * Poll audio levels from all connected feeds.
   */
  private pollAllFeeds(): void {
    const connectedFeeds = this.registry.getConnectedFeeds()

    for (const feed of connectedFeeds) {
      const obs = this.connectionManager.getConnection(feed.id)
      if (!obs) {
        this.handleMissedPoll(feed.id)
        continue
      }

      this.pollFeed(feed.id, obs)
    }

    // Handle feeds that are no longer connected but still have state
    for (const feedId of this.feedStates.keys()) {
      const feed = this.registry.getActiveFeed(feedId)
      if (!feed || feed.connectionStatus !== 'connected') {
        this.handleMissedPoll(feedId)
      }
    }
  }

  /**
   * Poll a single feed's audio level via GetInputVolumeMeter.
   * Note: GetInputVolumeMeter is a valid OBS WebSocket request but may not be
   * typed in all versions of obs-websocket-js. We use a type assertion.
   */
  private pollFeed(feedId: string, obs: OBSWebSocket): void {
    ;(obs.call as any)('GetInputVolumeMeter')
      .then((response: any) => {
        this.handlePollSuccess(feedId, response)
      })
      .catch(() => {
        this.handleMissedPoll(feedId)
      })
  }

  /**
   * Handle a successful audio poll response.
   * Extracts the peak dB value, normalizes it, and pushes to the buffer.
   */
  private handlePollSuccess(feedId: string, response: any): void {
    const dbValue = this.extractDbValue(response)
    if (dbValue === null) {
      this.handleMissedPoll(feedId)
      return
    }

    const state = this.getOrCreateFeedState(feedId)

    // On data resumption after zeroing, reset the buffer
    if (state.wasZeroed) {
      state.buffer.reset()
      state.wasZeroed = false
    }

    // Reset consecutive misses
    state.consecutiveMisses = 0

    // Normalize and push to buffer
    const normalized = normalizeDb(dbValue, this.config.dbFloor, this.config.dbCeiling)
    state.buffer.push(normalized)

    // Update score
    this.scores.set(feedId, state.buffer.average())
  }

  /**
   * Handle a missed poll (connection error, invalid data, etc.).
   * After 3 consecutive misses, set Activity Score to 0.
   */
  private handleMissedPoll(feedId: string): void {
    const state = this.getOrCreateFeedState(feedId)
    state.consecutiveMisses++

    if (state.consecutiveMisses >= MISSED_POLL_THRESHOLD) {
      this.scores.set(feedId, 0)
      state.wasZeroed = true
    }
  }

  /**
   * Extract the peak dB value from a GetInputVolumeMeter response.
   * OBS returns an array of input levels; we take the maximum peak value.
   */
  private extractDbValue(response: any): number | null {
    try {
      // OBS WebSocket GetInputVolumeMeter returns inputLevelsMul as an array of arrays
      // Each sub-array contains [magnitude, peak] for each channel
      // We use the highest peak across all inputs/channels
      const inputs = response?.inputLevelsMul
      if (!inputs || !Array.isArray(inputs) || inputs.length === 0) {
        return null
      }

      let maxPeak = -Infinity
      for (const channels of inputs) {
        if (!Array.isArray(channels)) continue
        for (const channel of channels) {
          if (!Array.isArray(channel) || channel.length < 2) continue
          // channel[1] is the peak value (linear 0-1 scale from OBS)
          const peak = channel[1]
          if (typeof peak === 'number' && isFinite(peak)) {
            // Convert linear multiplier to dB: 20 * log10(value)
            // OBS returns linear values, we need dB for normalization
            const db = peak > 0 ? 20 * Math.log10(peak) : -Infinity
            if (db > maxPeak) {
              maxPeak = db
            }
          }
        }
      }

      return maxPeak === -Infinity ? null : maxPeak
    } catch {
      return null
    }
  }

  /**
   * Emit current scores to all registered callbacks.
   */
  private emitScores(): void {
    if (this.callbacks.length === 0) return

    const scoresCopy = new Map(this.scores)
    for (const callback of this.callbacks) {
      try {
        callback(scoresCopy)
      } catch {
        // Ignore callback errors
      }
    }
  }

  /**
   * Get or create the audio state for a feed.
   */
  private getOrCreateFeedState(feedId: string): FeedAudioState {
    let state = this.feedStates.get(feedId)
    if (!state) {
      const bufferCapacity = this.computeBufferCapacity()
      state = {
        buffer: new CircularBuffer(bufferCapacity),
        consecutiveMisses: 0,
        wasZeroed: false,
      }
      this.feedStates.set(feedId, state)
    }
    return state
  }

  /**
   * Compute the buffer capacity based on rolling window and poll interval.
   * bufferSize = rollingWindowMs / pollIntervalMs
   */
  private computeBufferCapacity(): number {
    return Math.max(1, Math.floor(this.config.rollingWindowMs / this.config.pollIntervalMs))
  }

  /**
   * Rebuild all feed buffers when config changes affect capacity.
   */
  private rebuildBuffers(): void {
    const newCapacity = this.computeBufferCapacity()
    for (const [feedId, state] of this.feedStates) {
      if (state.buffer.capacity !== newCapacity) {
        // Create new buffer; existing data is lost (acceptable on config change)
        state.buffer = new CircularBuffer(newCapacity)
        state.consecutiveMisses = 0
        state.wasZeroed = false
        this.scores.set(feedId, 0)
      }
    }
  }
}

// ── Utility ──────────────────────────────────────────────────────────────────

/**
 * Clamp a value between min and max bounds.
 */
function clampValue(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
