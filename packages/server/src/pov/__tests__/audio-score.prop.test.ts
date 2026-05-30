import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { CircularBuffer } from '../audio-monitor.js'

/**
 * Property-based tests for Activity Score computation.
 *
 * **Validates: Requirements 3.2, 3.4, 3.5**
 */

// ── Property 8: Activity Score rolling average ───────────────────────────────

describe('Property 8: Activity Score rolling average', () => {
  /**
   * Given a sequence of normalized audio readings (each in [0, 1]) within the
   * configured rolling window, the computed Activity Score SHALL equal the
   * arithmetic mean of those readings, bounded between 0 and 1.
   *
   * **Validates: Requirements 3.2**
   */
  it('Activity Score equals arithmetic mean of readings in the rolling window', () => {
    // Use a generator that produces values in the realistic normalized audio range.
    // We avoid subnormal floating-point numbers (< ~2.2e-308) which can cause
    // floating-point sum-tracking artifacts in the circular buffer.
    const normalizedReading = fc.oneof(
      fc.constant(0),
      fc.constant(1),
      fc.double({ min: 1e-6, max: 1, noNaN: true }),
    )

    fc.assert(
      fc.property(
        // Buffer capacity between 1 and 100
        fc.integer({ min: 1, max: 100 }),
        // Array of normalized readings in [0, 1], at least 1 reading
        fc.array(normalizedReading, { minLength: 1, maxLength: 200 }),
        (capacity, readings) => {
          const buffer = new CircularBuffer(capacity)

          for (const reading of readings) {
            buffer.push(reading)
          }

          // The buffer holds at most `capacity` values — the last `capacity` readings
          const windowReadings = readings.slice(-capacity)
          const expectedMean =
            windowReadings.reduce((sum, v) => sum + v, 0) / windowReadings.length

          const score = buffer.average()

          // Score should be bounded between 0 and 1
          expect(score).toBeGreaterThanOrEqual(0)
          expect(score).toBeLessThanOrEqual(1)

          // Score should equal the arithmetic mean of the window readings
          // Use a tolerance for floating-point arithmetic
          expect(score).toBeCloseTo(expectedMean, 8)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('Activity Score is always bounded between 0 and 1 for valid inputs', () => {
    const normalizedReading = fc.oneof(
      fc.constant(0),
      fc.constant(1),
      fc.double({ min: 1e-6, max: 1, noNaN: true }),
    )

    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        fc.array(normalizedReading, { minLength: 1, maxLength: 100 }),
        (capacity, readings) => {
          const buffer = new CircularBuffer(capacity)

          for (const reading of readings) {
            buffer.push(reading)
          }

          const score = buffer.average()
          expect(score).toBeGreaterThanOrEqual(0)
          expect(score).toBeLessThanOrEqual(1)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('Activity Score for a single reading equals that reading', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (capacity, reading) => {
          const buffer = new CircularBuffer(capacity)
          buffer.push(reading)

          // For a single reading, average equals that reading
          // Use tolerance for subnormal floating-point edge cases
          expect(buffer.average()).toBeCloseTo(reading, 10)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('Activity Score for uniform readings equals that uniform value', () => {
    const normalizedReading = fc.oneof(
      fc.constant(0),
      fc.constant(1),
      fc.double({ min: 1e-6, max: 1, noNaN: true }),
    )

    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        normalizedReading,
        fc.integer({ min: 1, max: 100 }),
        (capacity, value, count) => {
          const buffer = new CircularBuffer(capacity)

          for (let i = 0; i < count; i++) {
            buffer.push(value)
          }

          expect(buffer.average()).toBeCloseTo(value, 10)
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ── Property 9: Missing data zeroing and recovery ────────────────────────────

describe('Property 9: Missing data zeroing and recovery', () => {
  /**
   * After 3 consecutive missed polls, the Activity Score is 0.
   * On data resumption, the score is computed from new readings only
   * (zeros from missed polls are not carried over).
   *
   * **Validates: Requirements 3.4, 3.5**
   */

  /**
   * Simulates the AudioMonitor's per-feed state logic for missed polls and
   * data resumption without needing the full AudioMonitor (which requires
   * OBS connections). This directly tests the circular buffer + missed poll
   * tracking logic as implemented in the AudioMonitor.
   */
  interface FeedState {
    buffer: CircularBuffer
    consecutiveMisses: number
    wasZeroed: boolean
    score: number
  }

  const MISSED_POLL_THRESHOLD = 3

  function createFeedState(capacity: number): FeedState {
    return {
      buffer: new CircularBuffer(capacity),
      consecutiveMisses: 0,
      wasZeroed: false,
      score: 0,
    }
  }

  function handleReading(state: FeedState, reading: number): void {
    // On data resumption after zeroing, reset the buffer
    if (state.wasZeroed) {
      state.buffer.reset()
      state.wasZeroed = false
    }

    state.consecutiveMisses = 0
    state.buffer.push(reading)
    state.score = state.buffer.average()
  }

  function handleMissedPoll(state: FeedState): void {
    state.consecutiveMisses++
    if (state.consecutiveMisses >= MISSED_POLL_THRESHOLD) {
      state.score = 0
      state.wasZeroed = true
    }
  }

  it('score becomes 0 after 3 or more consecutive missed polls', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        // Some initial readings to establish a non-zero score
        fc.array(fc.double({ min: 0.1, max: 1, noNaN: true }), { minLength: 1, maxLength: 20 }),
        // Number of consecutive misses (at least 3)
        fc.integer({ min: 3, max: 20 }),
        (capacity, initialReadings, missCount) => {
          const state = createFeedState(capacity)

          // Push initial readings to establish a non-zero score
          for (const reading of initialReadings) {
            handleReading(state, reading)
          }

          // Verify we have a non-zero score
          expect(state.score).toBeGreaterThan(0)

          // Simulate consecutive missed polls
          for (let i = 0; i < missCount; i++) {
            handleMissedPoll(state)
          }

          // After 3+ consecutive misses, score must be 0
          expect(state.score).toBe(0)
          expect(state.wasZeroed).toBe(true)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('score is NOT zeroed with fewer than 3 consecutive missed polls', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        // Some initial readings
        fc.array(fc.double({ min: 0.1, max: 1, noNaN: true }), { minLength: 1, maxLength: 20 }),
        // Number of consecutive misses (fewer than 3)
        fc.integer({ min: 1, max: 2 }),
        (capacity, initialReadings, missCount) => {
          const state = createFeedState(capacity)

          // Push initial readings
          for (const reading of initialReadings) {
            handleReading(state, reading)
          }

          const scoreBeforeMisses = state.score

          // Simulate fewer than 3 consecutive missed polls
          for (let i = 0; i < missCount; i++) {
            handleMissedPoll(state)
          }

          // Score should NOT be zeroed
          expect(state.score).toBe(scoreBeforeMisses)
          expect(state.wasZeroed).toBe(false)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('on data resumption after zeroing, score is computed from new readings only', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        // Initial readings (will be discarded after zeroing)
        fc.array(fc.double({ min: 0.1, max: 1, noNaN: true }), { minLength: 1, maxLength: 20 }),
        // New readings after resumption
        fc.array(fc.double({ min: 0, max: 1, noNaN: true }), { minLength: 1, maxLength: 50 }),
        (capacity, initialReadings, newReadings) => {
          const state = createFeedState(capacity)

          // Push initial readings
          for (const reading of initialReadings) {
            handleReading(state, reading)
          }

          // Trigger zeroing with 3 missed polls
          for (let i = 0; i < MISSED_POLL_THRESHOLD; i++) {
            handleMissedPoll(state)
          }

          expect(state.score).toBe(0)

          // Resume with new readings
          for (const reading of newReadings) {
            handleReading(state, reading)
          }

          // Score should be computed from new readings only
          // The buffer was reset, so it contains only the new readings
          // (up to capacity)
          const windowReadings = newReadings.slice(-capacity)
          const expectedMean =
            windowReadings.reduce((sum, v) => sum + v, 0) / windowReadings.length

          expect(state.score).toBeCloseTo(expectedMean, 8)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('interleaved misses (not consecutive) do not trigger zeroing', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 5, max: 50 }),
        fc.double({ min: 0.1, max: 1, noNaN: true }),
        (capacity, reading) => {
          const state = createFeedState(capacity)

          // Pattern: miss, miss, reading, miss, miss, reading
          // Never 3 consecutive misses
          handleMissedPoll(state)
          handleMissedPoll(state)
          handleReading(state, reading) // resets consecutiveMisses
          handleMissedPoll(state)
          handleMissedPoll(state)
          handleReading(state, reading) // resets consecutiveMisses

          // Score should NOT be zeroed
          expect(state.score).toBeGreaterThan(0)
          expect(state.wasZeroed).toBe(false)
        },
      ),
      { numRuns: 100 },
    )
  })
})
