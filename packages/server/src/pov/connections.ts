import OBSWebSocket from 'obs-websocket-js'
import { EventEmitter } from 'events'
import type { CameraFeed, CameraConnectionStatus } from '@ieom/shared'

// ── Constants ────────────────────────────────────────────────────────────────

/** Exponential backoff delays: 15s → 30s → 60s → 120s → 300s */
export const RETRY_DELAYS_MS = [15_000, 30_000, 60_000, 120_000, 300_000] as const

/** Maximum number of retry attempts before marking feed as unreachable */
export const MAX_RETRY_ATTEMPTS = 5

/** Default health check interval in milliseconds */
export const DEFAULT_HEALTH_CHECK_INTERVAL_MS = 10_000

/** Health check timeout in milliseconds */
export const HEALTH_CHECK_TIMEOUT_MS = 5_000

// ── Types ────────────────────────────────────────────────────────────────────

export interface ConnectionStatusChangeEvent {
  feedId: string
  status: CameraConnectionStatus
  previousStatus: CameraConnectionStatus
}

export interface CameraConnectionManagerEvents {
  statusChange: [event: ConnectionStatusChangeEvent]
}

/** Internal state tracked per feed connection */
interface FeedConnection {
  feedId: string
  obs: OBSWebSocket
  status: CameraConnectionStatus
  retryAttempt: number
  retryTimer: ReturnType<typeof setTimeout> | null
  healthCheckTimer: ReturnType<typeof setTimeout> | null
  address: string
  password: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Compute the retry delay for a given attempt number (0-indexed).
 * Formula: min(15000 × 2^attempt, 300000)
 */
export function computeRetryDelay(attempt: number): number {
  return Math.min(15_000 * Math.pow(2, attempt), 300_000)
}

// ── CameraConnectionManager ─────────────────────────────────────────────────

export class CameraConnectionManager extends EventEmitter {
  private connections = new Map<string, FeedConnection>()
  private healthCheckIntervalMs: number = DEFAULT_HEALTH_CHECK_INTERVAL_MS
  private globalHealthCheckTimer: ReturnType<typeof setInterval> | null = null

  constructor() {
    super()
  }

  /**
   * Initiate a WebSocket connection to a camera feed's OBS instance.
   * Connection is attempted asynchronously; status changes are emitted via events.
   */
  async connect(feed: CameraFeed): Promise<void> {
    // If already tracking this feed, disconnect first
    if (this.connections.has(feed.id)) {
      this.disconnect(feed.id)
    }

    const obs = new OBSWebSocket()
    const conn: FeedConnection = {
      feedId: feed.id,
      obs,
      status: 'disconnected',
      retryAttempt: 0,
      retryTimer: null,
      healthCheckTimer: null,
      address: feed.obsAddress,
      password: feed.obsPassword,
    }

    this.connections.set(feed.id, conn)

    // Listen for unexpected disconnections
    obs.on('ConnectionClosed', () => {
      // Only handle if we still track this connection
      if (!this.connections.has(feed.id)) return
      const current = this.connections.get(feed.id)!
      if (current.status === 'connected' || current.status === 'unresponsive') {
        this.updateStatus(feed.id, 'disconnected')
        this.scheduleRetry(feed.id)
      }
    })

    // Attempt initial connection
    await this.attemptConnection(feed.id)
  }

  /**
   * Disconnect a specific feed and clean up all timers/resources.
   */
  disconnect(feedId: string): void {
    const conn = this.connections.get(feedId)
    if (!conn) return

    this.clearTimers(conn)

    try {
      conn.obs.disconnect()
    } catch {
      // Ignore disconnect errors
    }

    conn.obs.removeAllListeners()
    this.connections.delete(feedId)
  }

  /**
   * Disconnect all feeds and clean up.
   */
  disconnectAll(): void {
    for (const feedId of [...this.connections.keys()]) {
      this.disconnect(feedId)
    }
    this.stopHealthChecks()
  }

  /**
   * Get the OBS WebSocket instance for a feed (if connected).
   */
  getConnection(feedId: string): OBSWebSocket | undefined {
    const conn = this.connections.get(feedId)
    if (conn && conn.status === 'connected') {
      return conn.obs
    }
    return undefined
  }

  /**
   * Check if a feed is currently connected.
   */
  isConnected(feedId: string): boolean {
    const conn = this.connections.get(feedId)
    return conn?.status === 'connected' || false
  }

  /**
   * Get the current connection status for a feed.
   */
  getStatus(feedId: string): CameraConnectionStatus | undefined {
    return this.connections.get(feedId)?.status
  }

  /**
   * Start periodic health checks for all connected feeds.
   */
  startHealthChecks(intervalMs: number = DEFAULT_HEALTH_CHECK_INTERVAL_MS): void {
    this.healthCheckIntervalMs = intervalMs
    this.stopHealthChecks()

    this.globalHealthCheckTimer = setInterval(() => {
      this.runHealthChecks()
    }, this.healthCheckIntervalMs)
  }

  /**
   * Stop the global health check polling.
   */
  stopHealthChecks(): void {
    if (this.globalHealthCheckTimer) {
      clearInterval(this.globalHealthCheckTimer)
      this.globalHealthCheckTimer = null
    }
  }

  // ── Private Methods ──────────────────────────────────────────────────────

  /**
   * Attempt to connect to the OBS instance for a given feed.
   */
  private async attemptConnection(feedId: string): Promise<void> {
    const conn = this.connections.get(feedId)
    if (!conn) return

    this.updateStatus(feedId, 'reconnecting')

    try {
      await conn.obs.connect(conn.address, conn.password || undefined)
      // Connection successful
      conn.retryAttempt = 0
      this.updateStatus(feedId, 'connected')
    } catch {
      // Connection failed — schedule retry if attempts remain
      this.scheduleRetry(feedId)
    }
  }

  /**
   * Schedule a retry with exponential backoff.
   * After MAX_RETRY_ATTEMPTS, mark the feed as unreachable.
   */
  private scheduleRetry(feedId: string): void {
    const conn = this.connections.get(feedId)
    if (!conn) return

    if (conn.retryAttempt >= MAX_RETRY_ATTEMPTS) {
      this.updateStatus(feedId, 'unreachable')
      return
    }

    const delay = computeRetryDelay(conn.retryAttempt)
    conn.retryAttempt += 1

    this.updateStatus(feedId, 'reconnecting')

    conn.retryTimer = setTimeout(() => {
      conn.retryTimer = null
      if (this.connections.has(feedId)) {
        void this.attemptConnection(feedId)
      }
    }, delay)
  }

  /**
   * Run health checks on all connected feeds.
   * Uses GetVersion as a lightweight request with a 5s timeout.
   */
  private runHealthChecks(): void {
    for (const [feedId, conn] of this.connections) {
      if (conn.status !== 'connected' && conn.status !== 'unresponsive') {
        continue
      }

      this.checkFeedHealth(feedId, conn)
    }
  }

  /**
   * Perform a single health check on a feed.
   * Calls GetVersion with a 5s timeout.
   * On timeout: mark as unresponsive.
   * On success: restore to connected if previously unresponsive.
   */
  private checkFeedHealth(feedId: string, conn: FeedConnection): void {
    let timedOut = false

    const timeoutHandle = setTimeout(() => {
      timedOut = true
      if (this.connections.has(feedId) && conn.status === 'connected') {
        this.updateStatus(feedId, 'unresponsive')
      }
    }, HEALTH_CHECK_TIMEOUT_MS)

    conn.obs
      .call('GetVersion')
      .then(() => {
        clearTimeout(timeoutHandle)
        if (timedOut) return
        // Health check passed — restore if unresponsive
        if (this.connections.has(feedId) && conn.status === 'unresponsive') {
          this.updateStatus(feedId, 'connected')
        }
      })
      .catch(() => {
        clearTimeout(timeoutHandle)
        if (timedOut) return
        // Health check failed (not timeout) — mark unresponsive
        if (this.connections.has(feedId) && conn.status === 'connected') {
          this.updateStatus(feedId, 'unresponsive')
        }
      })
  }

  /**
   * Update the connection status for a feed and emit a status change event.
   */
  private updateStatus(feedId: string, newStatus: CameraConnectionStatus): void {
    const conn = this.connections.get(feedId)
    if (!conn) return

    const previousStatus = conn.status
    if (previousStatus === newStatus) return

    conn.status = newStatus

    const event: ConnectionStatusChangeEvent = {
      feedId,
      status: newStatus,
      previousStatus,
    }

    this.emit('statusChange', event)
  }

  /**
   * Clear all timers associated with a connection.
   */
  private clearTimers(conn: FeedConnection): void {
    if (conn.retryTimer) {
      clearTimeout(conn.retryTimer)
      conn.retryTimer = null
    }
    if (conn.healthCheckTimer) {
      clearTimeout(conn.healthCheckTimer)
      conn.healthCheckTimer = null
    }
  }
}
