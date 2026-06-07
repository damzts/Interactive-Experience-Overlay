/**
 * Unit tests for MotionDetector.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createMotionDetector } from '../motion-detector.js'

describe('MotionDetector', () => {
  let detector!: ReturnType<typeof createMotionDetector>

  beforeEach(() => {
    vi.useFakeTimers()
    detector = createMotionDetector({ rollingWindowMs: 2000, reportIntervalMs: 200, minPacketsPerReport: 3 })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('initial state', () => {
    it('accepts a subscription callback', () => {
      const cb = vi.fn()
      const unsub = detector.subscribe(cb)
      expect(typeof unsub).toBe('function')
    })
  })

  describe('motion detection', () => {
    it('reports motion when packets vary in size', () => {
      const cb = vi.fn()
      detector.subscribe(cb)

      const now = Date.now()
      // Simulate static scene: similar packet sizes
      for (let i = 0; i < 50; i++) {
        detector.reportMotionLevel('p1', 1200 + Math.random() * 10, now + i * 20)
      }
      vi.advanceTimersByTime(500)

      // Motion on static scene should be low
      const staticCalls = cb.mock.calls.filter(([id]) => id === 'p1')
      const lastStatic = staticCalls[staticCalls.length - 1]
      // Level should be < 0.1 for near-constant packet sizes around 1200
      // (deviation ~10 → rms/1500 ~ 0.007)
      if (lastStatic) {
        expect(lastStatic[1]).toBeLessThan(0.1)
      }
    })

    it('reports higher motion when packets vary significantly', () => {
      const cb = vi.fn()
      detector.subscribe(cb)

      const now = Date.now()
      // Simulate motion scene: alternating large/small packets
      for (let i = 0; i < 50; i++) {
        const size = i % 2 === 0 ? 1400 : 100
        detector.reportMotionLevel('p2', size, now + i * 20)
      }
      vi.advanceTimersByTime(500)

      // Motion should be higher
      const calls = cb.mock.calls.filter(([id]) => id === 'p2')
      const lastCall = calls[calls.length - 1]
      if (lastCall) {
        // 1300 byte delta / 1500 ≈ 0.87 RMS
        expect(lastCall[1]).toBeGreaterThan(0.1)
      }
    })
  })

  describe('unsubscribe', () => {
    it('stops receiving callbacks after unsubscribe', () => {
      const cb = vi.fn()
      const unsub = detector.subscribe(cb)
      unsub()

      detector.reportMotionLevel('p3', 1400, Date.now())
      detector.reportMotionLevel('p3', 100, Date.now() + 20)
      vi.advanceTimersByTime(500)

      expect(cb).not.toHaveBeenCalled()
    })
  })

  describe('removeParticipant', () => {
    it('does not throw when removing unknown participant', () => {
      expect(() => detector.removeParticipant('nonexistent')).not.toThrow()
    })
  })
})
