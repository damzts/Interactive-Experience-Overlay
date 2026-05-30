import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createAudioScoreProcessor } from '../audio-score-processor.js'

describe('AudioScoreProcessor', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('reportLevel', () => {
    it('clamps values below 0 to 0', () => {
      const processor = createAudioScoreProcessor()
      processor.start({ rollingWindowMs: 2000, reportIntervalMs: 100, emitIntervalMs: 500 })

      const now = Date.now()
      processor.reportLevel('p1', -0.5, now)

      const scores = processor.getScores()
      expect(scores.get('p1')).toBe(0)

      processor.stop()
    })

    it('clamps values above 1 to 1', () => {
      const processor = createAudioScoreProcessor()
      processor.start({ rollingWindowMs: 2000, reportIntervalMs: 100, emitIntervalMs: 500 })

      const now = Date.now()
      processor.reportLevel('p1', 1.5, now)

      const scores = processor.getScores()
      expect(scores.get('p1')).toBe(1)

      processor.stop()
    })

    it('stores values within [0, 1] as-is', () => {
      const processor = createAudioScoreProcessor()
      processor.start({ rollingWindowMs: 2000, reportIntervalMs: 100, emitIntervalMs: 500 })

      const now = Date.now()
      processor.reportLevel('p1', 0.7, now)

      const scores = processor.getScores()
      expect(scores.get('p1')).toBeCloseTo(0.7)

      processor.stop()
    })
  })

  describe('Activity Score computation', () => {
    it('computes arithmetic mean of readings within the rolling window', () => {
      const processor = createAudioScoreProcessor()
      processor.start({ rollingWindowMs: 2000, reportIntervalMs: 100, emitIntervalMs: 500 })

      const baseTime = Date.now()
      processor.reportLevel('p1', 0.2, baseTime)
      processor.reportLevel('p1', 0.4, baseTime + 100)
      processor.reportLevel('p1', 0.6, baseTime + 200)
      processor.reportLevel('p1', 0.8, baseTime + 300)

      const scores = processor.getScores()
      // Mean of [0.2, 0.4, 0.6, 0.8] = 0.5
      expect(scores.get('p1')).toBeCloseTo(0.5)

      processor.stop()
    })

    it('excludes readings outside the rolling window', () => {
      const processor = createAudioScoreProcessor()
      processor.start({ rollingWindowMs: 1000, reportIntervalMs: 100, emitIntervalMs: 500 })

      const baseTime = Date.now()
      // These readings are outside the window (older than 1000ms from "now")
      processor.reportLevel('p1', 0.9, baseTime - 1500)
      processor.reportLevel('p1', 0.9, baseTime - 1200)

      // These readings are within the window
      processor.reportLevel('p1', 0.2, baseTime - 500)
      processor.reportLevel('p1', 0.4, baseTime - 200)

      const scores = processor.getScores()
      // Mean of [0.2, 0.4] = 0.3
      expect(scores.get('p1')).toBeCloseTo(0.3)

      processor.stop()
    })

    it('returns 0 for a participant with no readings in window', () => {
      const processor = createAudioScoreProcessor()
      processor.start({ rollingWindowMs: 2000, reportIntervalMs: 100, emitIntervalMs: 500 })

      // Report and then advance time past the window
      const baseTime = Date.now()
      processor.reportLevel('p1', 0.5, baseTime - 3000)

      const scores = processor.getScores()
      // Reading is outside the 2000ms window
      expect(scores.get('p1')).toBe(0)

      processor.stop()
    })
  })

  describe('Consecutive missed reports', () => {
    it('sets score to 0 after 3 consecutive missed intervals', () => {
      const processor = createAudioScoreProcessor()
      processor.start({ rollingWindowMs: 2000, reportIntervalMs: 100, emitIntervalMs: 500 })

      const baseTime = Date.now()
      processor.reportLevel('p1', 0.8, baseTime)

      // Advance time by 500ms (triggers emit which checks misses)
      // At this point, 500ms / 100ms = 5 missed intervals >= 3
      vi.advanceTimersByTime(500)

      const scores = processor.getScores()
      expect(scores.get('p1')).toBe(0)

      processor.stop()
    })

    it('does not zero score if fewer than 3 intervals missed', () => {
      const processor = createAudioScoreProcessor()
      processor.start({ rollingWindowMs: 2000, reportIntervalMs: 100, emitIntervalMs: 500 })

      const baseTime = Date.now()
      processor.reportLevel('p1', 0.8, baseTime)

      // Advance only 150ms (1.5 intervals, rounds to 1 miss)
      vi.advanceTimersByTime(150)

      const scores = processor.getScores()
      // Should still have the score since < 3 misses
      expect(scores.get('p1')).toBeCloseTo(0.8)

      processor.stop()
    })

    it('resumes scoring from new readings only after gap (no carry-over of zeros)', () => {
      const processor = createAudioScoreProcessor()
      processor.start({ rollingWindowMs: 2000, reportIntervalMs: 100, emitIntervalMs: 500 })

      const baseTime = Date.now()
      processor.reportLevel('p1', 0.8, baseTime)

      // Advance time to trigger 3+ missed intervals
      vi.advanceTimersByTime(500) // triggers emit + missed check

      // Score should be 0 now
      let scores = processor.getScores()
      expect(scores.get('p1')).toBe(0)

      // Resume with new readings
      const resumeTime = Date.now()
      processor.reportLevel('p1', 0.3, resumeTime)
      processor.reportLevel('p1', 0.5, resumeTime + 100)

      scores = processor.getScores()
      // Mean of [0.3, 0.5] = 0.4 (old 0.8 reading is discarded)
      expect(scores.get('p1')).toBeCloseTo(0.4)

      processor.stop()
    })
  })

  describe('Periodic score emission', () => {
    it('emits scores at the configured interval', () => {
      const processor = createAudioScoreProcessor()
      const callback = vi.fn()
      processor.onScoresUpdated(callback)

      processor.start({ rollingWindowMs: 2000, reportIntervalMs: 100, emitIntervalMs: 500 })

      const now = Date.now()
      processor.reportLevel('p1', 0.5, now)

      // Advance to first emit
      vi.advanceTimersByTime(500)
      expect(callback).toHaveBeenCalledTimes(1)

      // Advance to second emit
      vi.advanceTimersByTime(500)
      expect(callback).toHaveBeenCalledTimes(2)

      processor.stop()
    })

    it('emits scores with correct values', () => {
      const processor = createAudioScoreProcessor()
      const callback = vi.fn()
      processor.onScoresUpdated(callback)

      processor.start({ rollingWindowMs: 2000, reportIntervalMs: 100, emitIntervalMs: 500 })

      const now = Date.now()
      // Report levels continuously so they don't trigger missed-report zeroing
      processor.reportLevel('p1', 0.6, now)
      processor.reportLevel('p2', 0.4, now)

      // Advance 200ms and report again (within 3 intervals)
      vi.advanceTimersByTime(200)
      const t2 = Date.now()
      processor.reportLevel('p1', 0.6, t2)
      processor.reportLevel('p2', 0.4, t2)

      // Advance remaining 300ms to trigger emit at 500ms total
      vi.advanceTimersByTime(300)

      expect(callback).toHaveBeenCalledTimes(1)
      const emittedScores = callback.mock.calls[0][0] as Map<string, number>
      expect(emittedScores.get('p1')).toBeCloseTo(0.6)
      expect(emittedScores.get('p2')).toBeCloseTo(0.4)

      processor.stop()
    })

    it('stops emitting after stop() is called', () => {
      const processor = createAudioScoreProcessor()
      const callback = vi.fn()
      processor.onScoresUpdated(callback)

      processor.start({ rollingWindowMs: 2000, reportIntervalMs: 100, emitIntervalMs: 500 })
      processor.stop()

      vi.advanceTimersByTime(1000)
      expect(callback).not.toHaveBeenCalled()
    })
  })

  describe('removeParticipant', () => {
    it('removes a participant from tracking', () => {
      const processor = createAudioScoreProcessor()
      processor.start({ rollingWindowMs: 2000, reportIntervalMs: 100, emitIntervalMs: 500 })

      const now = Date.now()
      processor.reportLevel('p1', 0.5, now)
      processor.reportLevel('p2', 0.7, now)

      processor.removeParticipant('p1')

      const scores = processor.getScores()
      expect(scores.has('p1')).toBe(false)
      expect(scores.has('p2')).toBe(true)

      processor.stop()
    })
  })

  describe('Multiple participants', () => {
    it('tracks scores independently per participant', () => {
      const processor = createAudioScoreProcessor()
      processor.start({ rollingWindowMs: 2000, reportIntervalMs: 100, emitIntervalMs: 500 })

      const now = Date.now()
      processor.reportLevel('p1', 0.2, now)
      processor.reportLevel('p1', 0.4, now + 100)
      processor.reportLevel('p2', 0.8, now)
      processor.reportLevel('p2', 0.6, now + 100)

      const scores = processor.getScores()
      expect(scores.get('p1')).toBeCloseTo(0.3) // mean(0.2, 0.4)
      expect(scores.get('p2')).toBeCloseTo(0.7) // mean(0.8, 0.6)

      processor.stop()
    })
  })
})
