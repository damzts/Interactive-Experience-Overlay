/**
 * Unit tests for CloudCircuitBreaker.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CircuitBreaker, CircuitOpenError } from '../../lib/cloud-circuit-breaker.js'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker

  beforeEach(() => {
    vi.useFakeTimers()
    breaker = new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 15_000, requestTimeoutMs: 5_000 })
  })

  afterEach(() => {
    breaker.destroy()
    vi.useRealTimers()
  })

  // ── Initial state ────────────────────────────────────────────────

  describe('initial state', () => {
    it('starts in CLOSED state', () => {
      const state = breaker.getState()
      expect(state.state).toBe('CLOSED')
      expect(state.failureCount).toBe(0)
    })

    it('canTry returns true initially', () => {
      expect(breaker.canTry()).toBe(true)
    })
  })

  // ── Successful calls ─────────────────────────────────────────────

  describe('successful calls', () => {
    it('returns response on success', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }))
      const res = await breaker.call('http://test.dev')
      expect(res.status).toBe(200)
    })

    it('stays CLOSED after success', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }))
      await breaker.call('http://test.dev')
      expect(breaker.getState().state).toBe('CLOSED')
      expect(breaker.getState().failureCount).toBe(0)
    })

    it('recovers from HALF_OPEN on success', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network error'))
      for (let i = 0; i < 3; i++) {
        await breaker.call('http://test.dev').catch(() => {})
      }
      vi.advanceTimersByTime(16_000) // → HALF_OPEN

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }))
      const res = await breaker.call('http://test.dev')
      expect(res.status).toBe(200)
      expect(breaker.getState().state).toBe('CLOSED')
    })
  })

  // ── Failures → OPEN → HALF_OPEN → recovery ─────────────────────

  describe('failure state machine', () => {
    it('opens after failureThreshold failures', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network error'))
      for (let i = 0; i < 3; i++) {
        await breaker.call('http://test.dev').catch(() => {})
      }
      expect(breaker.getState().state).toBe('OPEN')
      expect(breaker.getState().failureCount).toBe(3)
    })

    it('rejects immediately when OPEN (CircuitOpenError)', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network error'))
      for (let i = 0; i < 3; i++) {
        await breaker.call('http://test.dev').catch(() => {})
      }

      const spy = vi.spyOn(globalThis, 'fetch').mockReset()
      await expect(breaker.call('http://test.dev')).rejects.toThrow(CircuitOpenError)
      expect(spy).not.toHaveBeenCalled()
    })

    it('transitions to HALF_OPEN after resetTimeoutMs', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network error'))
      for (let i = 0; i < 3; i++) {
        await breaker.call('http://test.dev').catch(() => {})
      }
      expect(breaker.getState().state).toBe('OPEN')

      vi.advanceTimersByTime(16_000)
      expect(breaker.getState().state).toBe('HALF_OPEN')
    })

    it('opens again after HALF_OPEN failure', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network error'))
      for (let i = 0; i < 3; i++) {
        await breaker.call('http://test.dev').catch(() => {})
      }
      vi.advanceTimersByTime(16_000)

      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network error'))
      await expect(breaker.call('http://test.dev')).rejects.toThrow()
      expect(breaker.getState().state).toBe('OPEN')
    })

    it('does not open on 4xx errors', async () => {
      for (let i = 0; i < 5; i++) {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 404 }))
        await breaker.call('http://test.dev')
      }
      expect(breaker.getState().state).toBe('CLOSED')
    })

    it('opens on 5xx errors', async () => {
      for (let i = 0; i < 3; i++) {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 502 }))
        await breaker.call('http://test.dev')
      }
      expect(breaker.getState().state).toBe('OPEN')
    })
  })

  // ── HTTP timeout ─────────────────────────────────────────────────

  describe('request timeout', () => {
    it('aborts after requestTimeoutMs', async () => {
      vi.useRealTimers()
      const realBreaker = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 1000, requestTimeoutMs: 100 })

      // Mock fetch that aborts when signal fires
      vi.spyOn(globalThis, 'fetch').mockImplementation(
        (_url: string, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            if (init?.signal?.aborted) {
              reject(new DOMException('Aborted', 'AbortError'))
              return
            }
            init?.signal?.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'))
            }, { once: true })
          }),
      )

      const promise = realBreaker.call('http://test.dev')
      await expect(promise).rejects.toThrow()
      expect(realBreaker.getState().state).toBe('OPEN')

      realBreaker.destroy()
    })
  })

  // ── tryOrFallback ────────────────────────────────────────────────

  describe('tryOrFallback', () => {
    it('returns fn result when circuit is closed', async () => {
      const result = await breaker.tryOrFallback(
        () => Promise.resolve('ok'),
        'fallback',
      )
      expect(result).toBe('ok')
    })

    it('returns fallback when circuit is open', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network error'))
      for (let i = 0; i < 3; i++) {
        await breaker.call('http://test.dev').catch(() => {})
      }

      const result = await breaker.tryOrFallback(
        () => Promise.resolve('ok'),
        'fallback',
      )
      expect(result).toBe('fallback')
    })

    it('returns fallback when fn throws', async () => {
      const result = await breaker.tryOrFallback(
        () => Promise.reject(new Error('fail')),
        'fallback',
      )
      expect(result).toBe('fallback')
    })
  })

  // ── Manual reset ─────────────────────────────────────────────────

  describe('reset', () => {
    it('resets to CLOSED from OPEN', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('net'))
      for (let i = 0; i < 3; i++) {
        await breaker.call('http://test.dev').catch(() => {})
      }
      expect(breaker.getState().state).toBe('OPEN')

      breaker.reset()
      expect(breaker.getState().state).toBe('CLOSED')
      expect(breaker.getState().failureCount).toBe(0)
    })

    it('allows calls after reset', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('net'))
      for (let i = 0; i < 3; i++) {
        await breaker.call('http://test.dev').catch(() => {})
      }
      breaker.reset()

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }))
      const res = await breaker.call('http://test.dev')
      expect(res.status).toBe(200)
    })
  })
})
