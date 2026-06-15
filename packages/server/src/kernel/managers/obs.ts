/**
 * ObsBridgeManager — conecta a OBS WebSocket y controla virtual cam / RTMP / Browser Source.
 *
 * USO:
 *   1. Abrir OBS → Tools → WebSocket Server Settings → habilitar, anotar puerto+password
 *   2. En el admin panel: Settings → OBS → URL (ws://localhost:4455) + password
 *   3. "Auto-setup" crea un Browser Source apuntando a la URL del overlay local
 *   4. Virtual cam toggle activa/desactiva la cámara virtual
 *   5. RTMP puede usarse para enviar a OBS remoto
 *
 * Requiere OBS 28+ con obs-websocket 5.x.
 */

import OBSWebSocket from 'obs-websocket-js'
import type { Server } from 'socket.io'
import type { Manager, ManagerStatus, ObsStatusPayload } from '@ieomlabs/shared'
import logger from '../../lib/logger.js'
import type { SceneManager } from './scene.js'
import type { KernelBus } from '../bus.js'

export class ObsBridgeManager implements Manager {
  readonly name = 'ObsBridgeManager'
  private _status: ManagerStatus = 'idle'
  private obs = new OBSWebSocket()
  private connected = false
  private connecting = false
  private currentUrl = 'ws://localhost:4455'
  private currentPassword = ''
  private lastError: string | null = null
  private _virtualCamActive = false
  private _streaming = false
  private _recording = false
  private _overlaySourceAdded = false
  /** URL que el Browser Source usa para mostrar el overlay */
  private overlayUrl = 'http://localhost:3000/overlay'

  constructor(
    private io: Server,
    private machine: SceneManager,
    private bus?: KernelBus,
  ) {
    this.obs.on('ConnectionClosed', () => {
      if (this.connected) {
        this.connected = false
        logger.info('[obs] connection closed')
      }
      this.lastError = 'Connection closed'
      this.emitStatus()
    })

    // Track virtual cam state via events
    this.obs.on('CurrentProgramSceneChanged', () => { this.emitStatus() })
  }

  connect(url = 'ws://localhost:4455', password = '') {
    this.updateConnection(url, password)
  }

  // ── Manager interface ────────────────────────────────────────
  init(): void { this._status = 'idle' }
  start(): void { this._status = 'running'; this.connect() }
  stop(): void { this._status = 'stopped' }
  dispose(): void { this.stop(); this.obs.disconnect() }
  status(): ManagerStatus { return this._status }

  updateConnection(url = this.currentUrl, password = this.currentPassword) {
    const changed = url !== this.currentUrl || password !== this.currentPassword
    this.currentUrl = url
    this.currentPassword = password

    if (!changed && (this.connected || this.connecting)) return

    this.lastError = null
    this.emitStatus()

    void this.openConnection()
  }

  getStatus(): ObsStatusPayload {
    return {
      connected: this.connected,
      url: this.currentUrl,
      reconnecting: this.connecting,
      lastError: this.lastError,
      virtualCamActive: this._virtualCamActive,
      streaming: this._streaming,
      recording: this._recording,
      overlaySourceAdded: this._overlaySourceAdded,
    }
  }

  /** Set the overlay URL for Browser Source auto-creation */
  setOverlayUrl(url: string) { this.overlayUrl = url }

  // ── Virtual Cam ──────────────────────────────────────────────

  /** Toggle virtual cam on/off */
  async toggleVirtualCam(): Promise<{ ok: boolean; error?: string }> {
    if (!this.connected) return { ok: false, error: 'obs_not_connected' }
    try {
      if (this._virtualCamActive) {
        await this.obs.call('StopVirtualCam')
        this._virtualCamActive = false
        logger.info('[obs] virtual cam stopped')
      } else {
        await this.obs.call('StartVirtualCam')
        this._virtualCamActive = true
        logger.info('[obs] virtual cam started')
      }
      this.emitStatus()
      return { ok: true }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.lastError = msg
      logger.error({ err: msg }, '[obs] virtual cam toggle failed')
      this.emitStatus()
      return { ok: false, error: msg }
    }
  }

  // ── RTMP / Streaming ─────────────────────────────────────────

  /** Start streaming to a custom RTMP URL (or use OBS's configured service) */
  async startStreaming(rtmpUrl?: string, streamKey?: string): Promise<{ ok: boolean; error?: string }> {
    if (!this.connected) return { ok: false, error: 'obs_not_connected' }
    try {
      if (rtmpUrl && streamKey) {
        // Set custom RTMP output before starting
        await this.obs.call('SetStreamServiceSettings', {
          streamServiceType: 'rtmp_custom',
          streamServiceSettings: {
            server: rtmpUrl,
            key: streamKey,
          },
        })
      }

      await this.obs.call('StartStream')
      this._streaming = true
      logger.info(`[obs] stream started${rtmpUrl ? ` (RTMP: ${rtmpUrl})` : ''}`)
      this.emitStatus()
      return { ok: true }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.lastError = msg
      logger.error({ err: msg }, '[obs] start stream failed')
      this.emitStatus()
      return { ok: false, error: msg }
    }
  }

  /** Stop streaming */
  async stopStreaming(): Promise<{ ok: boolean; error?: string }> {
    if (!this.connected) return { ok: false, error: 'obs_not_connected' }
    try {
      await this.obs.call('StopStream')
      this._streaming = false
      logger.info('[obs] stream stopped')
      this.emitStatus()
      return { ok: true }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.lastError = msg
      logger.error({ err: msg }, '[obs] stop stream failed')
      this.emitStatus()
      return { ok: false, error: msg }
    }
  }

  // ── Browser Source auto-setup ────────────────────────────────

  /** Create (or verify) an OBS Browser Source pointing to the overlay URL */
  async ensureOverlaySource(
    sourceName = 'IEOM Overlay',
    width = 1920,
    height = 1080,
  ): Promise<{ ok: boolean; error?: string }> {
    if (!this.connected) return { ok: false, error: 'obs_not_connected' }
    try {
      // Check if source already exists
      const existing = await this.obs.call('GetInputList', { inputKind: 'browser_source' })
      const exists = existing.inputs?.some((i: any) => i.inputName === sourceName)

      if (!exists) {
        await this.obs.call('CreateInput', {
          sceneName: this.overlayUrl.includes('overlay') ? undefined : undefined,
          inputName: sourceName,
          inputKind: 'browser_source',
          inputSettings: {
            url: this.overlayUrl,
            width,
            height,
            fps: 60,
            shutdown: false,
          },
        })
        logger.info(`[obs] created browser source "${sourceName}" → ${this.overlayUrl}`)
      } else {
        // Update the URL in case it changed
        await this.obs.call('SetInputSettings', {
          inputName: sourceName,
          inputSettings: { url: this.overlayUrl },
        })
        logger.info(`[obs] updated browser source "${sourceName}" → ${this.overlayUrl}`)
      }

      this._overlaySourceAdded = true
      this.emitStatus()
      return { ok: true }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.lastError = msg
      this._overlaySourceAdded = false
      logger.error({ err: msg }, '[obs] browser source setup failed')
      this.emitStatus()
      return { ok: false, error: msg }
    }
  }

  // ── Internal ─────────────────────────────────────────────────

  private emitStatus() {
    this.io.emit('obs:status', this.getStatus())
  }

  private setupListeners() {
    this.obs.on('StreamStateChanged', (data: { outputActive: boolean }) => {
      const prev = this._streaming
      this._streaming = data.outputActive
      this.emitStatus()
      if (!prev && data.outputActive) {
        logger.info('[obs] stream started (event)')
        this.bus?.emit('obs:stream:started', {})
      } else if (prev && !data.outputActive) {
        logger.info('[obs] stream stopped (event)')
        this.bus?.emit('obs:stream:stopped', {})
      }
    })

    this.obs.on('RecordStateChanged', (data: { outputActive: boolean }) => {
      const prev = this._recording
      this._recording = data.outputActive
      this.emitStatus()
      if (!prev && data.outputActive) {
        logger.info('[obs] recording started (event)')
        this.bus?.emit('obs:recording:started', {})
      } else if (prev && !data.outputActive) {
        logger.info('[obs] recording stopped (event)')
        this.bus?.emit('obs:recording:stopped', {})
      }
    })

    this.obs.on('VirtualcamStateChanged', (data: { outputActive: boolean }) => {
      this._virtualCamActive = data.outputActive
      this.emitStatus()
      this.bus?.emit('obs:virtualcam:changed', { active: data.outputActive })
    })
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
      logger.info(`[obs] connected to OBS WebSocket (${this.currentUrl})`)

      // Refresh virtual cam + streaming state
      try {
        const vc = await this.obs.call('GetVirtualCamStatus')
        this._virtualCamActive = vc.outputActive as boolean
      } catch { /* ignore on older OBS */ }
      try {
        const s = await this.obs.call('GetStreamStatus')
        this._streaming = s.outputActive as boolean
      } catch { /* ignore */ }

      this.emitStatus()
      this.setupListeners()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.lastError = message
      this.connected = false
      logger.warn(`[obs] connection failed (${message}) — configure OBS settings to retry`)
      this.emitStatus()
    } finally {
      this.connecting = false
      this.emitStatus()
    }
  }

}
