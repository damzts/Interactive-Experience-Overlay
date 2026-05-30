import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'
import { createAudioScoreProcessor } from '../audio-score-processor.js'

describe('AudioScoreProcessor - Property Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // Feature: browser-pov-online, Property 9: Rolling average activity score
  describe('Property 9: Rolling average activity score', () => {
    /**
     * **Validates: Requirements 6.1**
     *
     * For any sequence of audio level reports (each in [0, 1]) with timestamps
     * within the configured rolling window, the computed Activity Score SHALL
     * equal the arithmetic mean of those reports, bounded between 0 and 1.
     */
    it('activity score equals arithmetic mean of reports within the rolling window', () => {
      fc.assert(
        fc.property(
          // Generate a rolling window between 500ms and 5000ms
          fc.integer({ min: 500, max: 5000 }),
          // Generate 1-50 audio level reports, each in [0, 1]
          fc.array(fc.double({ min: 0, max: 1, noNaN: true }), { minLength: 1, maxLength: 50 }),
          (rollingWindowMs, levels) => {
            const processor = createAudioScoreProcessor()
            processor.start({
              rollingWindowMs,
              reportIntervalMs: 100,
              emitIntervalMs: 500,
            })

            const baseTime = Date.now()
            // Space reports evenly within the rolling window so all are included
            const interval = levels.length > 1
              ? Math.floor(rollingWindowMs / (levels.length + 1))
              : 0

            for (let i = 0; i < levels.length; i++) {
              const timestamp = baseTime + (i * interval)
              processor.reportLevel('participant-1', levels[i], timestamp)
            }

            // Set Date.now() to the time of the last report so all are within window
            const lastTimestamp = baseTime + ((levels.length - 1) * interval)
            vi.setSystemTime(lastTimestamp)

            const scores = processor.getScores()
            const score = scores.get('participant-1')!

            // Compute expected arithmetic mean
            const expectedMean = levels.reduce((sum, l) => sum + l, 0) / levels.length

            // Score should equal the arithmetic mean
            expect(score).toBeCloseTo(expectedMean, 5)

            // Score must be bounded between 0 and 1
            expect(score).toBeGreaterThanOrEqual(0)
            expect(score).toBeLessThanOrEqual(1)

            processor.stop()
          }
        ),
        { numRuns: 100 }
      )
    })

    it('score is bounded between 0 and 1 regardless of input distribution', () => {
      fc.assert(
        fc.property(
          // Generate levels that might be at extremes
          fc.array(
            fc.oneof(
              fc.constant(0),
              fc.constant(1),
              fc.double({ min: 0, max: 1, noNaN: true })
            ),
            { minLength: 1, maxLength: 100 }
          ),
          (levels) => {
            const processor = createAudioScoreProcessor()
            processor.start({
              rollingWindowMs: 5000,
              reportIntervalMs: 100,
              emitIntervalMs: 500,
            })

            const baseTime = Date.now()
            for (let i = 0; i < levels.length; i++) {
              processor.reportLevel('participant-1', levels[i], baseTime + i * 50)
            }

            vi.setSystemTime(baseTime + (levels.length - 1) * 50)

            const scores = processor.getScores()
            const score = scores.get('participant-1')!

            expect(score).toBeGreaterThanOrEqual(0)
            expect(score).toBeLessThanOrEqual(1)

            processor.stop()
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  // Feature: browser-pov-online, Property 10: Missing data zeroing and recovery
  describe('Property 10: Missing data zeroing and recovery', () => {
    /**
     * **Validates: Requirements 6.3, 6.4**
     *
     * For any participant, if they fail to send an audio level report for 3 or
     * more consecutive expected intervals, their Activity Score SHALL be 0.
     * When reports resume, the Activity Score SHALL be computed only from new
     * reports received after the gap, without carrying over the zero values.
     */
    it('score becomes 0 after 3+ consecutive missed intervals', () => {
      fc.assert(
        fc.property(
          // Report interval between 50-500ms
          fc.integer({ min: 50, max: 500 }),
          // Number of missed intervals (at least 3)
          fc.integer({ min: 3, max: 20 }),
          // Initial audio level
          fc.double({ min: 0.1, max: 1, noNaN: true }),
          (reportIntervalMs, missedIntervals, initialLevel) => {
            const processor = createAudioScoreProcessor()
            processor.start({
              rollingWindowMs: 5000,
              reportIntervalMs,
              emitIntervalMs: reportIntervalMs, // emit at same rate to trigger miss checks
            })

            const baseTime = Date.now()
            // Send an initial report
            processor.reportLevel('participant-1', initialLevel, baseTime)

            // Advance time by enough to miss 3+ intervals
            // The emit interval triggers checkMissedReports
            const gapMs = (missedIntervals + 1) * reportIntervalMs
            vi.advanceTimersByTime(gapMs)

            const scores = processor.getScores()
            const score = scores.get('participant-1')!

            // Score must be 0 after missing 3+ intervals
            expect(score).toBe(0)

            processor.stop()
          }
        ),
        { numRuns: 100 }
      )
    })

    it('recovery computes score only from new reports after the gap', () => {
      fc.assert(
        fc.property(
          // Report interval
          fc.integer({ min: 50, max: 200 }),
          // Number of missed intervals (at least 3)
          fc.integer({ min: 3, max: 10 }),
          // Pre-gap levels (should be discarded after recovery)
          fc.array(fc.double({ min: 0.1, max: 1, noNaN: true }), { minLength: 1, maxLength: 10 }),
          // Post-gap levels (should be the only ones used for score)
          fc.array(fc.double({ min: 0.1, max: 1, noNaN: true }), { minLength: 1, maxLength: 10 }),
          (reportIntervalMs, missedIntervals, preGapLevels, postGapLevels) => {
            const processor = createAudioScoreProcessor()
            processor.start({
              rollingWindowMs: 10000, // large window so all post-gap readings are included
              reportIntervalMs,
              emitIntervalMs: reportIntervalMs,
            })

            const baseTime = Date.now()

            // Send pre-gap reports at proper intervals
            for (let i = 0; i < preGapLevels.length; i++) {
              processor.reportLevel('participant-1', preGapLevels[i], baseTime + i * reportIntervalMs)
            }

            // The last pre-gap report timestamp
            const lastPreGapTimestamp = baseTime + (preGapLevels.length - 1) * reportIntervalMs

            // Advance system time to the last pre-gap report first
            vi.setSystemTime(lastPreGapTimestamp)

            // Now advance time to create a gap of 3+ missed intervals AFTER the last report
            // We need (missedIntervals + 1) * reportIntervalMs to ensure checkMissedReports
            // detects at least `missedIntervals` missed intervals from the last report
            const gapMs = (missedIntervals + 1) * reportIntervalMs
            vi.advanceTimersByTime(gapMs)

            // Verify score is 0 during the gap
            const gapScores = processor.getScores()
            expect(gapScores.get('participant-1')).toBe(0)

            // Resume with new reports
            const resumeTime = Date.now()
            for (let i = 0; i < postGapLevels.length; i++) {
              processor.reportLevel('participant-1', postGapLevels[i], resumeTime + i * reportIntervalMs)
            }

            // Set time to the last post-gap report
            vi.setSystemTime(resumeTime + (postGapLevels.length - 1) * reportIntervalMs)

            const scores = processor.getScores()
            const score = scores.get('participant-1')!

            // Expected: arithmetic mean of ONLY post-gap levels
            const expectedMean = postGapLevels.reduce((sum, l) => sum + l, 0) / postGapLevels.length

            expect(score).toBeCloseTo(expectedMean, 5)

            // Pre-gap levels should NOT influence the score
            // (If they did, the mean would be different)

            processor.stop()
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
