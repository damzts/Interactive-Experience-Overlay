/**
 * CloudCircuitBreaker — protege conexiones HTTP y WS hacia el cloud API.
 *
 * Estados:
 *   CLOSED  → normal, requests pasan
 *   OPEN    → fallos consecutivos, requests rechazan inmediatamente
 *   HALF_OPEN → después del timeout de recuperación, permite 1 request de prueba
 *
 * Si el request de prueba falla → OPEN otra vez.
 * Si pasa → CLOSED.
 */

import logger from './logger.js'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface CircuitBreakerConfig {
  /** Máximo de fallos consecutivos antes de abrir el circuito (default: 3) */
  failureThreshold: number
  /** Tiempo en ms antes de pasar a HALF_OPEN (default: 15s) */
  resetTimeoutMs: number
  /** Timeout por request HTTP en ms (default: 8s) */
  requestTimeoutMs: number
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 3,
  resetTimeoutMs: 15_000,
  requestTimeoutMs: 8_000,
}

// ---------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

// ---------------------------------------------------------------------------
// CircuitBreaker class
// ---------------------------------------------------------------------------

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED'
  private failureCount = 0
  private lastFailureTime = 0
  private config: CircuitBreakerConfig
  private halfOpenTimer: ReturnType<typeof setTimeout> | null = null

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  // ── Public API ──────────────────────────────────────────────────

  /**
   * Execute a fetch call through the circuit breaker.
   * Returns the Response if successful, or throws on circuit open / request failure.
   */
  async call(url: string, init?: RequestInit): Promise<Response> {
    this.tryTransition()

    if (this.state === 'OPEN') {
      const elapsed = Date.now() - this.lastFailureTime
      throw new CircuitOpenError(
        `Circuit open for ${elapsed}ms (${this.failureCount} failures)`,
      )
    }

    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), this.config.requestTimeoutMs)
      const signal = init?.signal
        ? anySignal([init.signal, controller.signal])
        : controller.signal

      const response = await fetch(url, { ...init, signal })

      clearTimeout(timer)

      if (!response.ok) {
        // HTTP errors count as failures (5xx, not 4xx)
        if (response.status >= 500) {
          this.recordFailure()
        }
        return response
      }

      this.recordSuccess()
      return response
    } catch (err: any) {
      if (err instanceof CircuitOpenError) throw err
      this.recordFailure()
      throw err
    }
  }

  /** Quick check — useful before trying a WS connection */
  canTry(): boolean {
    this.tryTransition()
    return this.state !== 'OPEN'
  }

  /** Force reset the circuit (e.g. user clicked "retry") */
  reset(): void {
    this.state = 'CLOSED'
    this.failureCount = 0
    if (this.halfOpenTimer) { clearTimeout(this.halfOpenTimer); this.halfOpenTimer = null }
    logger.info('[circuit] Reset to CLOSED')
  }

  /** Get current state for UI / logging */
  getState(): { state: CircuitState; failureCount: number } {
    return { state: this.state, failureCount: this.failureCount }
  }

  /** Retry-allowed helper — runs callback only if circuit permits, else returns fallback */
  async tryOrFallback<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
    if (!this.canTry()) return fallback
    try {
      return await fn()
    } catch {
      return fallback
    }
  }

  // ── Internal ────────────────────────────────────────────────────

  private recordSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      logger.info('[circuit] HALF_OPEN → CLOSED (success)')
    }
    this.state = 'CLOSED'
    this.failureCount = 0
  }

  private recordFailure(): void {
    this.failureCount++
    this.lastFailureTime = Date.now()
    if (this.failureCount >= this.config.failureThreshold) {
      if (this.state !== 'OPEN') {
        logger.info({ value: this.failureCount }, '[circuit] Opening circuit')
      }
      this.state = 'OPEN'
      this.scheduleHalfOpen()
    }
  }

  private scheduleHalfOpen(): void {
    if (this.halfOpenTimer) clearTimeout(this.halfOpenTimer)
    this.halfOpenTimer = setTimeout(() => {
      if (this.state === 'OPEN') {
        logger.info('[circuit] OPEN → HALF_OPEN (timer expired)')
        this.state = 'HALF_OPEN'
      }
    }, this.config.resetTimeoutMs)
  }

  private tryTransition(): void {
    // If OPEN and more than 2x reset timeout elapsed, force HALF_OPEN
    if (this.state === 'OPEN' && Date.now() - this.lastFailureTime > this.config.resetTimeoutMs * 2) {
      this.state = 'HALF_OPEN'
      logger.info('[circuit] OPEN → HALF_OPEN (forced by elapsed time)')
      if (this.halfOpenTimer) { clearTimeout(this.halfOpenTimer); this.halfOpenTimer = null }
    }
  }

  // ── Cleanup ─────────────────────────────────────────────────────

  destroy(): void {
    if (this.halfOpenTimer) clearTimeout(this.halfOpenTimer)
  }
}

// ── Error class ────────────────────────────────────────────────────

export class CircuitOpenError extends Error {
  readonly name = 'CircuitOpenError'
}

// ── Helper: combine multiple AbortSignals ─────────────────────────

function anySignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController()
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason)
      return controller.signal
    }
    signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true })
  }
  return controller.signal
}
