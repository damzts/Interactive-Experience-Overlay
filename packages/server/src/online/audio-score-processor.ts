/**
 * AudioScoreProcessor — computes rolling-average Activity Scores from
 * client-reported audio levels. One instance per online room.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

// ── Types ────────────────────────────────────────────────────────

interface TimestampedReading {
  level: number
  timestamp: number
}

export interface AudioScoreProcessorConfig {
  /** Rolling window for activity score computation (ms) */
  rollingWindowMs: number
  /** Expected interval between audio level reports (ms) */
  reportIntervalMs: number
  /** Interval at which scores are emitted to listeners (ms) */
  emitIntervalMs: number
}

export interface AudioScoreProcessor {
  /** Process an incoming audio level report (0-1 linear) */
  reportLevel(participantId: string, level: number, timestamp: number): void

  /** Get current activity scores for all participants */
  getScores(): Map<string, number>

  /** Remove a participant from tracking */
  removeParticipant(participantId: string): void

  /** Start periodic score emission */
  start(config: AudioScoreProcessorConfig): void

  /** Stop periodic emission */
  stop(): void

  /** Register callback for score updates */
  onScoresUpdated(callback: (scores: Map<string, number>) => void): void
}

// ── Internal per-participant state ───────────────────────────────

interface ParticipantState {
  /** Circular buffer of timestamped readings */
  readings: TimestampedReading[]
  /** Pointer to next write position in the circular buffer */
  writeIndex: number
  /** Number of valid entries in the buffer (up to capacity) */
  count: number
  /** Timestamp of the last received report */
  lastReportTimestamp: number
  /** Number of consecutive missed report intervals */
  consecutiveMisses: number
}

// ── Constants ────────────────────────────────────────────────────

/** Number of consecutive missed intervals before zeroing the score */
const MISS_THRESHOLD = 3

/** Maximum buffer capacity per participant (generous upper bound) */
const BUFFER_CAPACITY = 200

// ── Implementation ───────────────────────────────────────────────

export function createAudioScoreProcessor(): AudioScoreProcessor {
  const participants = new Map<string, ParticipantState>()
  const callbacks: Array<(scores: Map<string, number>) => void> = []

  let config: AudioScoreProcessorConfig | null = null
  let emitTimer: ReturnType<typeof setInterval> | null = null

  // ── Helpers ──────────────────────────────────────────────────

  function getOrCreateState(participantId: string): ParticipantState {
    let state = participants.get(participantId)
    if (!state) {
      state = {
        readings: new Array<TimestampedReading>(BUFFER_CAPACITY),
        writeIndex: 0,
        count: 0,
        lastReportTimestamp: 0,
        consecutiveMisses: 0,
      }
      participants.set(participantId, state)
    }
    return state
  }

  function clamp(value: number, min: number, max: number): number {
    if (value < min) return min
    if (value > max) return max
    return value
  }

  /**
   * Compute the activity score for a participant as the arithmetic mean
   * of readings within the rolling window relative to `now`.
   */
  function computeScore(state: ParticipantState, rollingWindowMs: number, now: number): number {
    if (state.consecutiveMisses >= MISS_THRESHOLD) {
      return 0
    }

    const windowStart = now - rollingWindowMs
    let sum = 0
    let count = 0

    // Iterate over valid entries in the circular buffer
    const totalEntries = state.count
    for (let i = 0; i < totalEntries; i++) {
      // Walk backwards from the most recent write position
      const idx = (state.writeIndex - 1 - i + BUFFER_CAPACITY) % BUFFER_CAPACITY
      const reading = state.readings[idx]
      if (reading.timestamp < windowStart) {
        break // Readings are ordered by time; older ones are further back
      }
      sum += reading.level
      count++
    }

    if (count === 0) return 0
    return sum / count
  }

  function computeAllScores(): Map<string, number> {
    const scores = new Map<string, number>()
    if (!config) return scores

    const now = Date.now()
    for (const [id, state] of participants) {
      scores.set(id, computeScore(state, config.rollingWindowMs, now))
    }
    return scores
  }

  function emitScores(): void {
    const scores = computeAllScores()
    for (const cb of callbacks) {
      cb(scores)
    }
  }

  /**
   * Check for missed reports. Called on each emit interval.
   * A miss is detected when the time since the last report exceeds
   * the expected report interval. We subtract 1 because the interval
   * in which the last report was sent is not a "missed" interval.
   */
  function checkMissedReports(): void {
    if (!config) return

    const now = Date.now()
    for (const [, state] of participants) {
      if (state.lastReportTimestamp === 0) continue

      const elapsed = now - state.lastReportTimestamp
      // How many full report intervals have been missed since the last report.
      // We subtract 1 because the current interval (in which the last report
      // was sent) is not considered missed until the next interval passes.
      const missedIntervals = Math.max(0, Math.floor(elapsed / config.reportIntervalMs) - 1)
      if (missedIntervals > 0) {
        state.consecutiveMisses = missedIntervals
      }
    }
  }

  // ── Public API ───────────────────────────────────────────────

  function reportLevel(participantId: string, level: number, timestamp: number): void {
    const state = getOrCreateState(participantId)

    // Clamp incoming level to [0, 1]
    const clampedLevel = clamp(level, 0, 1)

    // On report resumption after misses, clear old readings so score
    // is computed only from new reports (no carry-over of zeros).
    if (state.consecutiveMisses >= MISS_THRESHOLD) {
      state.count = 0
      state.writeIndex = 0
    }

    // Reset consecutive misses on receiving a report
    state.consecutiveMisses = 0
    state.lastReportTimestamp = timestamp

    // Write to circular buffer
    state.readings[state.writeIndex] = { level: clampedLevel, timestamp }
    state.writeIndex = (state.writeIndex + 1) % BUFFER_CAPACITY
    if (state.count < BUFFER_CAPACITY) {
      state.count++
    }
  }

  function getScores(): Map<string, number> {
    return computeAllScores()
  }

  function removeParticipant(participantId: string): void {
    participants.delete(participantId)
  }

  function start(cfg: AudioScoreProcessorConfig): void {
    config = cfg

    // Stop any existing timer
    if (emitTimer !== null) {
      clearInterval(emitTimer)
    }

    emitTimer = setInterval(() => {
      checkMissedReports()
      emitScores()
    }, cfg.emitIntervalMs)
  }

  function stop(): void {
    if (emitTimer !== null) {
      clearInterval(emitTimer)
      emitTimer = null
    }
  }

  function onScoresUpdated(callback: (scores: Map<string, number>) => void): void {
    callbacks.push(callback)
  }

  return {
    reportLevel,
    getScores,
    removeParticipant,
    start,
    stop,
    onScoresUpdated,
  }
}
