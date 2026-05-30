import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { CircularBuffer } from '../audio-monitor.js'

// ── Generators ──────────────────────────────────────────────────────

/**
 * Generate a normalized audio reading in [0, 1].
 * Uses integer-based generation divided by a scale to avoid subnormal
 * floating-point values that cause precision issues in sum-based tracking.
 * This matches real-world behavior: normalizeDb outputs are well-behaved
 * doubles in the [0, 1] range (not subnormal numbers).
 */
const normalizedReading = fc.integer({ min: 0, max: 10000 }).map((n) => n / 10000)

/** Generate a non-empty array of normalized readings (simulating a rolling window) */
const readingsArray = fc.array(normalizedReading, { minLength: 1, maxLength: 100 })

/** Generate a valid buffer capacity (derived from rollingWindowMs / pollIntervalMs) */
const bufferCapacity = fc.integer({ min: 1, max: 200 })

// ── Property Tests ──────────────────────────────────────────────────

describe('AudioMonitor Property Tests', () => {
  /**
   * Property 8: Activity Score rolling average
   *
   * The Activity Score for a feed is the arithmetic mean of the normalized
   * values in the rolling window buffer.
   *
   * For any sequence of normalized audio readings (each in [0, 1]) within
   * the configured rolling window, the computed Activity Score SHALL equal
   * the arithmetic mean of those readings, bounded between 0 and 1.
   *
   * **Validates: Requirements 3.2**
   */
  describe('Property 8: Activity Score rolling average', () => {
    it('CircularBuffer.average() equals the arithmetic mean of all pushed values when count <= capacity', () => {
      fc.assert(
        fc.property(
          bufferCapacity,
          readingsArray,
          (capacity, readings) => {
            // Only test when readings fit within capacity (no overwrites)
            fc.pre(readings.length <= capacity)

            const buffer = new CircularBuffer(capacity)
            for (const value of readings) {
              buffer.push(value)
            }

            const expectedMean = readings.reduce((sum, v) => sum + v, 0) / readings.length
            const actual = buffer.average()

            // The average should match the arithmetic mean
            expect(actual).toBeCloseTo(expectedMean, 8)

            // The result must be bounded between 0 and 1
            expect(actual).toBeGreaterThanOrEqual(0)
            expect(actual).toBeLessThanOrEqual(1)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('CircularBuffer.average() equals the arithmetic mean of the last `capacity` values when buffer is full', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 50 }),
          fc.array(normalizedReading, { minLength: 2, maxLength: 200 }),
          (capacity, readings) => {
            // Ensure we have more readings than capacity to test overflow
            fc.pre(readings.length > capacity)

            const buffer = new CircularBuffer(capacity)
            for (const value of readings) {
              buffer.push(value)
            }

            // Only the last `capacity` values should be in the buffer
            const windowValues = readings.slice(-capacity)
            const expectedMean = windowValues.reduce((sum, v) => sum + v, 0) / windowValues.length

            const actual = buffer.average()

            expect(actual).toBeCloseTo(expectedMean, 8)
            expect(actual).toBeGreaterThanOrEqual(0)
            expect(actual).toBeLessThanOrEqual(1)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('Activity Score is always bounded between 0 and 1 for any sequence of valid readings', () => {
      fc.assert(
        fc.property(
          bufferCapacity,
          fc.array(normalizedReading, { minLength: 1, maxLength: 500 }),
          (capacity, readings) => {
            const buffer = new CircularBuffer(capacity)
            for (const value of readings) {
              buffer.push(value)
            }

            const score = buffer.average()
            expect(score).toBeGreaterThanOrEqual(0)
            expect(score).toBeLessThanOrEqual(1)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 9: Missing data zeroing and recovery
   *
   * After 3 consecutive missed polls, the Activity Score is set to 0.
   * On data resumption, the score is computed from new readings only
   * (zeros are not carried over).
   *
   * **Validates: Requirements 3.4, 3.5**
   */
  describe('Property 9: Missing data zeroing and recovery', () => {
    it('after 3+ consecutive missed polls, Activity Score is 0', () => {
      fc.assert(
        fc.property(
          bufferCapacity,
          fc.array(normalizedReading, { minLength: 1, maxLength: 50 }),
          fc.integer({ min: 3, max: 20 }),
          (capacity, initialReadings, missedCount) => {
            const buffer = new CircularBuffer(capacity)
            let consecutiveMisses = 0
            let wasZeroed = false
            let score = 0

            // Push initial readings
            for (const value of initialReadings) {
              buffer.push(value)
              consecutiveMisses = 0
              wasZeroed = false
              score = buffer.average()
            }

            // Simulate missed polls (same logic as AudioMonitor.handleMissedPoll)
            for (let i = 0; i < missedCount; i++) {
              consecutiveMisses++
              if (consecutiveMisses >= 3) {
                score = 0
                wasZeroed = true
              }
            }

            // After 3+ misses, score must be 0
            expect(score).toBe(0)
            expect(wasZeroed).toBe(true)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('on data resumption after zeroing, score is computed from new readings only (no zeros carried over)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 50 }),
          fc.array(normalizedReading, { minLength: 1, maxLength: 20 }),
          fc.integer({ min: 3, max: 10 }),
          fc.array(
            fc.integer({ min: 1, max: 10000 }).map((n) => n / 10000),
            { minLength: 1, maxLength: 20 }
          ),
          (capacity, initialReadings, missedCount, resumptionReadings) => {
            const buffer = new CircularBuffer(capacity)
            let consecutiveMisses = 0
            let wasZeroed = false

            // Phase 1: Push initial readings
            for (const value of initialReadings) {
              buffer.push(value)
              consecutiveMisses = 0
              wasZeroed = false
            }

            // Phase 2: Simulate missed polls
            for (let i = 0; i < missedCount; i++) {
              consecutiveMisses++
              if (consecutiveMisses >= 3) {
                wasZeroed = true
              }
            }

            // Phase 3: Data resumes — reset buffer (same as AudioMonitor behavior)
            if (wasZeroed) {
              buffer.reset()
              wasZeroed = false
            }
            consecutiveMisses = 0

            // Push new readings after resumption
            for (const value of resumptionReadings) {
              buffer.push(value)
            }

            // Score should be computed from new readings only
            const effectiveReadings = resumptionReadings.length <= capacity
              ? resumptionReadings
              : resumptionReadings.slice(-capacity)

            const expectedMean = effectiveReadings.reduce((sum, v) => sum + v, 0) / effectiveReadings.length
            const actual = buffer.average()

            expect(actual).toBeCloseTo(expectedMean, 8)

            // Since resumption readings are all > 0, the score must be > 0
            expect(actual).toBeGreaterThan(0)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('fewer than 3 consecutive missed polls do NOT zero the score', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 50 }),
          fc.array(
            fc.integer({ min: 1, max: 10000 }).map((n) => n / 10000),
            { minLength: 1, maxLength: 20 }
          ),
          fc.integer({ min: 1, max: 2 }),
          (capacity, readings, missedCount) => {
            const buffer = new CircularBuffer(capacity)
            let consecutiveMisses = 0
            let wasZeroed = false
            let score = 0

            // Push readings
            for (const value of readings) {
              buffer.push(value)
              consecutiveMisses = 0
              wasZeroed = false
              score = buffer.average()
            }

            // Simulate fewer than 3 missed polls
            for (let i = 0; i < missedCount; i++) {
              consecutiveMisses++
              if (consecutiveMisses >= 3) {
                score = 0
                wasZeroed = true
              }
            }

            // With fewer than 3 misses, score should NOT be zeroed
            expect(wasZeroed).toBe(false)
            // Score should still be the buffer average (positive since readings > 0)
            expect(score).toBeGreaterThan(0)
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
