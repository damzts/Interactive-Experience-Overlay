import type { SwitchMode } from '@ieom/shared'
import type { CameraRegistry } from './registry.js'

// ── Types ────────────────────────────────────────────────────────────────────

export interface POVSwitcherConfig {
  cooldownMs: number          // Default 3000, min 1000, max 30000
  activityThreshold: number   // Default 0.15, min 0.01, max 1.0
  silenceThreshold: number    // Default 0.05, min 0.0, max 1.0
}

export type SwitchReason = 'automatic' | 'manual' | 'fallback'

export type SwitchCallback = (prev: string | null, next: string, timestamp: number, reason: SwitchReason) => void
export type ModeChangeCallback = (mode: SwitchMode) => void

// ── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: POVSwitcherConfig = {
  cooldownMs: 3000,
  activityThreshold: 0.15,
  silenceThreshold: 0.05,
}

// ── POVSwitcher ──────────────────────────────────────────────────────────────

/**
 * POVSwitcher is the core decision engine that evaluates Activity Scores
 * and determines which camera feed should be active.
 *
 * Responsibilities:
 * - Evaluate scores and select the best camera based on thresholds
 * - Enforce cooldown between automatic switches
 * - Handle initial selection (no active camera)
 * - Implement tie-breaking logic
 * - Handle disconnects with immediate fallback
 * - Support manual mode with feed validation
 * - Emit switch and mode change events via callbacks
 */
export class POVSwitcher {
  private config: POVSwitcherConfig
  private _mode: SwitchMode = 'automatic'
  private _activeCameraId: string | null = null
  private _lastSwitchTimestamp: number | null = null

  /** Tracks when each feed was last active (feedId → timestamp) for tie-breaking */
  private lastActiveTimestamps: Map<string, number> = new Map()

  private switchCallbacks: SwitchCallback[] = []
  private modeChangeCallbacks: ModeChangeCallback[] = []

  constructor(
    private registry: CameraRegistry,
    config?: Partial<POVSwitcherConfig>,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  // ── Public Getters ─────────────────────────────────────────────────────────

  get mode(): SwitchMode {
    return this._mode
  }

  get activeCameraId(): string | null {
    return this._activeCameraId
  }

  get lastSwitchTimestamp(): number | null {
    return this._lastSwitchTimestamp
  }

  // ── Configuration ──────────────────────────────────────────────────────────

  /**
   * Update the switcher configuration.
   */
  updateConfig(config: Partial<POVSwitcherConfig>): void {
    if (config.cooldownMs !== undefined) {
      this.config.cooldownMs = config.cooldownMs
    }
    if (config.activityThreshold !== undefined) {
      this.config.activityThreshold = config.activityThreshold
    }
    if (config.silenceThreshold !== undefined) {
      this.config.silenceThreshold = config.silenceThreshold
    }
  }

  /**
   * Get the current configuration (for testing/inspection).
   */
  getConfig(): Readonly<POVSwitcherConfig> {
    return { ...this.config }
  }

  // ── Mode Management ────────────────────────────────────────────────────────

  /**
   * Set the switching mode.
   * - 'manual': suspends automatic evaluation
   * - 'automatic': resumes automatic evaluation
   */
  setMode(mode: SwitchMode): void {
    if (this._mode === mode) return

    this._mode = mode
    this.emitModeChange(mode)
  }

  // ── Manual Selection ───────────────────────────────────────────────────────

  /**
   * Manually select a camera feed.
   * Validates that the feed is connected before switching.
   * Returns { ok: true } on success, or { ok: false, error: string } on failure.
   */
  manualSelect(feedId: string): { ok: boolean; error?: string } {
    const feed = this.registry.getActiveFeed(feedId)

    if (!feed) {
      return { ok: false, error: 'feed_not_found' }
    }

    if (feed.connectionStatus !== 'connected') {
      return { ok: false, error: 'feed_unavailable' }
    }

    const prev = this._activeCameraId
    this.performSwitch(feedId, 'manual')

    return { ok: true }
  }

  // ── Score Evaluation ───────────────────────────────────────────────────────

  /**
   * Evaluate Activity Scores and determine if a switch should occur.
   * Called each time new scores are computed by the AudioMonitor.
   *
   * Decision logic:
   * 1. If mode is manual, do nothing
   * 2. If no active camera, select highest score immediately (no cooldown/threshold)
   * 3. If all scores below silence threshold, do nothing
   * 4. If within cooldown period, do nothing
   * 5. If a candidate exceeds current by activityThreshold, switch to it
   * 6. Tie-breaking: retain current if tied, otherwise select least-recently-active
   */
  evaluateScores(scores: Map<string, number>): void {
    // Manual mode suspends automatic switching
    if (this._mode === 'manual') return

    // Filter to only connected feeds
    const connectedScores = this.filterConnectedScores(scores)

    if (connectedScores.size === 0) return

    // Initial selection: no active camera set
    if (this._activeCameraId === null) {
      const best = this.selectHighestScore(connectedScores)
      if (best) {
        this.performSwitch(best, 'automatic')
      }
      return
    }

    // Check if current active camera is still connected
    const currentFeed = this.registry.getActiveFeed(this._activeCameraId)
    if (!currentFeed || currentFeed.connectionStatus !== 'connected') {
      // Active camera is gone, select best available immediately
      const best = this.selectHighestScore(connectedScores)
      if (best) {
        this.performSwitch(best, 'fallback')
      }
      return
    }

    // Silence threshold: if all scores below threshold, do nothing
    if (this.allBelowSilenceThreshold(connectedScores)) return

    // Cooldown enforcement
    if (this.isWithinCooldown()) return

    // Find the best candidate that exceeds current by activityThreshold
    const currentScore = connectedScores.get(this._activeCameraId) ?? 0
    const candidate = this.findBestCandidate(connectedScores, currentScore)

    if (candidate && candidate !== this._activeCameraId) {
      this.performSwitch(candidate, 'automatic')
    }
  }

  // ── Disconnect Handling ────────────────────────────────────────────────────

  /**
   * Handle a camera feed disconnecting.
   * If the disconnected feed is the active camera:
   * - In automatic mode: immediately select highest-scoring connected feed (bypass cooldown)
   * - In manual mode: switch to automatic mode and select highest-scoring feed
   */
  handleDisconnect(feedId: string): void {
    if (this._activeCameraId !== feedId) return

    if (this._mode === 'manual') {
      // Manual feed disconnect fallback: switch to automatic mode
      this._mode = 'automatic'
      this.emitModeChange('automatic')
    }

    // Select highest-scoring connected feed immediately (bypass cooldown)
    const connectedFeeds = this.registry.getConnectedFeeds()
    if (connectedFeeds.length === 0) {
      this._activeCameraId = null
      return
    }

    const scores = new Map<string, number>()
    for (const feed of connectedFeeds) {
      scores.set(feed.id, feed.activityScore)
    }

    const best = this.selectHighestScore(scores)
    if (best) {
      this.performSwitch(best, 'fallback')
    } else {
      this._activeCameraId = null
    }
  }

  // ── Event Registration ─────────────────────────────────────────────────────

  /**
   * Register a callback for switch events.
   */
  onSwitch(callback: SwitchCallback): void {
    this.switchCallbacks.push(callback)
  }

  /**
   * Remove a switch callback.
   */
  offSwitch(callback: SwitchCallback): void {
    const idx = this.switchCallbacks.indexOf(callback)
    if (idx !== -1) this.switchCallbacks.splice(idx, 1)
  }

  /**
   * Register a callback for mode change events.
   */
  onModeChange(callback: ModeChangeCallback): void {
    this.modeChangeCallbacks.push(callback)
  }

  /**
   * Remove a mode change callback.
   */
  offModeChange(callback: ModeChangeCallback): void {
    const idx = this.modeChangeCallbacks.indexOf(callback)
    if (idx !== -1) this.modeChangeCallbacks.splice(idx, 1)
  }

  // ── Private Methods ────────────────────────────────────────────────────────

  /**
   * Filter scores to only include connected feeds.
   */
  private filterConnectedScores(scores: Map<string, number>): Map<string, number> {
    const filtered = new Map<string, number>()
    for (const [feedId, score] of scores) {
      const feed = this.registry.getActiveFeed(feedId)
      if (feed && feed.connectionStatus === 'connected') {
        filtered.set(feedId, score)
      }
    }
    return filtered
  }

  /**
   * Check if all scores are below the silence threshold.
   */
  private allBelowSilenceThreshold(scores: Map<string, number>): boolean {
    for (const score of scores.values()) {
      if (score >= this.config.silenceThreshold) {
        return false
      }
    }
    return true
  }

  /**
   * Check if we are within the cooldown period.
   */
  private isWithinCooldown(): boolean {
    if (this._lastSwitchTimestamp === null) return false
    const elapsed = Date.now() - this._lastSwitchTimestamp
    return elapsed < this.config.cooldownMs
  }

  /**
   * Find the best candidate that exceeds the current score by activityThreshold.
   * Implements tie-breaking: retain current if tied, otherwise select least-recently-active.
   */
  private findBestCandidate(scores: Map<string, number>, currentScore: number): string | null {
    const threshold = this.config.activityThreshold
    let bestScore = -1
    let bestCandidates: string[] = []

    for (const [feedId, score] of scores) {
      // Candidate must exceed current by threshold
      if (score - currentScore < threshold) continue

      if (score > bestScore) {
        bestScore = score
        bestCandidates = [feedId]
      } else if (score === bestScore) {
        bestCandidates.push(feedId)
      }
    }

    if (bestCandidates.length === 0) return null
    if (bestCandidates.length === 1) return bestCandidates[0]

    // Tie-breaking: retain current if tied
    if (this._activeCameraId && bestCandidates.includes(this._activeCameraId)) {
      return this._activeCameraId
    }

    // Otherwise select least-recently-active
    return this.selectLeastRecentlyActive(bestCandidates)
  }

  /**
   * Select the feed with the highest score.
   * Implements tie-breaking: retain current if tied, otherwise select least-recently-active.
   */
  private selectHighestScore(scores: Map<string, number>): string | null {
    if (scores.size === 0) return null

    let bestScore = -1
    let bestCandidates: string[] = []

    for (const [feedId, score] of scores) {
      if (score > bestScore) {
        bestScore = score
        bestCandidates = [feedId]
      } else if (score === bestScore) {
        bestCandidates.push(feedId)
      }
    }

    if (bestCandidates.length === 0) return null
    if (bestCandidates.length === 1) return bestCandidates[0]

    // Tie-breaking: retain current if tied
    if (this._activeCameraId && bestCandidates.includes(this._activeCameraId)) {
      return this._activeCameraId
    }

    // Otherwise select least-recently-active
    return this.selectLeastRecentlyActive(bestCandidates)
  }

  /**
   * From a list of candidates, select the one that was active least recently.
   * Feeds that have never been active are considered "oldest" (timestamp 0).
   */
  private selectLeastRecentlyActive(candidates: string[]): string {
    let oldest = candidates[0]
    let oldestTimestamp = this.lastActiveTimestamps.get(candidates[0]) ?? 0

    for (let i = 1; i < candidates.length; i++) {
      const ts = this.lastActiveTimestamps.get(candidates[i]) ?? 0
      if (ts < oldestTimestamp) {
        oldestTimestamp = ts
        oldest = candidates[i]
      }
    }

    return oldest
  }

  /**
   * Perform the actual switch: update state, record timestamps, emit events.
   */
  private performSwitch(newFeedId: string, reason: SwitchReason): void {
    const prev = this._activeCameraId
    if (prev === newFeedId) return

    this._activeCameraId = newFeedId
    this._lastSwitchTimestamp = Date.now()

    // Record when this feed became active (for tie-breaking)
    this.lastActiveTimestamps.set(newFeedId, this._lastSwitchTimestamp)

    // Emit switch event
    this.emitSwitch(prev, newFeedId, this._lastSwitchTimestamp, reason)
  }

  /**
   * Emit a switch event to all registered callbacks.
   */
  private emitSwitch(prev: string | null, next: string, timestamp: number, reason: SwitchReason): void {
    for (const callback of this.switchCallbacks) {
      try {
        callback(prev, next, timestamp, reason)
      } catch {
        // Ignore callback errors
      }
    }
  }

  /**
   * Emit a mode change event to all registered callbacks.
   */
  private emitModeChange(mode: SwitchMode): void {
    for (const callback of this.modeChangeCallbacks) {
      try {
        callback(mode)
      } catch {
        // Ignore callback errors
      }
    }
  }
}
