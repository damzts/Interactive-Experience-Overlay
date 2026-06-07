import OBSWebSocket from 'obs-websocket-js'
import type { Server } from 'socket.io'
import type { Manager, ManagerStatus, ObsStatusPayload } from '@ieom/shared'
import type { SceneMachine } from './scene.js'
import logger from '../../lib/logger.js';


const OBS_RETRY_DELAYS_MS = [15_000, 30_000, 60_000, 120_000, 300_000] as const

export class ObsBridge implements Manager {
  readonly name = 'ObsBridge'
  private _status: ManagerStatus = 'idle'
  private obs = new OBSWebSocket()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private connected = false
  private connecting = false
  private currentUrl = 'ws://localhost:4455'
  private currentPassword = ''
  private reconnectAttempt = 0
  private retryDelayMs: number | null = null
  private nextRetryAt: number | null = null
  private lastError: string | null = null

  constructor(
    private io: Server,
    private machine: SceneMachine,
  ) {
    this.obs.on('ConnectionClosed', () => {
      if (this.connected) {
        this.connected = false
        logger.info('[obs] connection closed')
      }
      this.lastError = 'Connection closed'
      this.emitStatus()
      if (!this.connecting) this.scheduleReconnect()
    })
  }

  connect(url = 'ws://localhost:4455', password = '') {
    this.updateConnection(url, password)
  }

  // ── Manager interface ────────────────────────────────────────
  init(): void { this._status = 'idle' }
  start(): void { this._status = 'running'; this.connect() }
  stop(): void { this._status = 'stopped'; if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null } }
  dispose(): void { this.stop(); this.obs.disconnect() }
  status(): ManagerStatus { return this._status }

  updateConnection(url = this.currentUrl, password = this.currentPassword) {
    const changed = url !== this.currentUrl || password !== this.currentPassword
    this.currentUrl = url
    this.currentPassword = password

    if (!changed && (this.connected || this.connecting || this.reconnectTimer)) return

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    this.reconnectAttempt = 0
    this.retryDelayMs = null
    this.nextRetryAt = null
    this.lastError = null
    this.emitStatus()

    void this.openConnection()
  }

  getStatus(): ObsStatusPayload {
    return {
      connected: this.connected,
      url: this.currentUrl,
      reconnecting: this.connecting || this.reconnectTimer !== null,
      reconnectAttempt: this.reconnectAttempt,
      retryDelayMs: this.retryDelayMs,
      nextRetryAt: this.nextRetryAt,
      lastError: this.lastError,
    }
  }

  private emitStatus() {
    this.io.emit('obs:status', this.getStatus())
  }

  private setupListeners() {
    // Custom hotkey events — user binds hotkeys in OBS settings and maps them here
    // The hotkey names follow OBSBasic.* convention; configure via admin panel in v2
    // For v1 we listen for SceneItemEnableStateChanged as a proxy trigger approach
  }

  private async openConnection() {
    if (this.connecting) return
    this.connecting = true
    this.emitStatus()
    try {
      await this.obs.connect(this.currentUrl, this.currentPassword || undefined)
      this.connected = true
      this.reconnectAttempt = 0
      this.retryDelayMs = null
      this.nextRetryAt = null
      this.lastError = null
      logger.info({ url: this.currentUrl }, 'connected to OBS WebSocket')
        this.emitStatus()
      this.setupListeners()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.lastError = message
      this.connected = false
      this.emitStatus()
      this.scheduleReconnect()
    } finally {
      this.connecting = false
      this.emitStatus()
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return
    const delayMs = OBS_RETRY_DELAYS_MS[Math.min(this.reconnectAttempt, OBS_RETRY_DELAYS_MS.length - 1)]
    this.reconnectAttempt += 1
    this.retryDelayMs = delayMs
    this.nextRetryAt = Date.now() + delayMs
    logger.info({ lastError: this.lastError || null, attempt: this.reconnectAttempt, delaySec: Math.round(delayMs / 1000) }, 'OBS not connected, scheduling retry')
    this.emitStatus()
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.retryDelayMs = null
      this.nextRetryAt = null
      this.emitStatus()
      void this.openConnection()
    }, delayMs)
  }
}
