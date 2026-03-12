import OBSWebSocket from 'obs-websocket-js'
import type { Server } from 'socket.io'
import type { SceneMachine } from '../state/machine.js'

export class ObsBridge {
  private obs = new OBSWebSocket()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private connected = false
  private connecting = false
  private currentUrl = 'ws://localhost:4455'
  private currentPassword = ''

  constructor(
    private io: Server,
    private machine: SceneMachine,
  ) {
    this.obs.on('ConnectionClosed', () => {
      if (this.connected) {
        this.connected = false
        console.log('[obs] connection closed')
        this.io.emit('obs:status', { connected: false })
      }
      if (!this.connecting) this.scheduleReconnect()
    })
  }

  connect(url = 'ws://localhost:4455', password = '') {
    this.updateConnection(url, password)
  }

  updateConnection(url = this.currentUrl, password = this.currentPassword) {
    const changed = url !== this.currentUrl || password !== this.currentPassword
    this.currentUrl = url
    this.currentPassword = password

    if (!changed && (this.connected || this.connecting || this.reconnectTimer)) return

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    void this.openConnection()
  }

  private setupListeners() {
    // Custom hotkey events — user binds hotkeys in OBS settings and maps them here
    // The hotkey names follow OBSBasic.* convention; configure via admin panel in v2
    // For v1 we listen for SceneItemEnableStateChanged as a proxy trigger approach
  }

  private async openConnection() {
    if (this.connecting) return
    this.connecting = true
    try {
      await this.obs.connect(this.currentUrl, this.currentPassword || undefined)
      this.connected = true
      console.log(`[obs] connected to OBS WebSocket (${this.currentUrl})`)
      this.io.emit('obs:status', { connected: true })
      this.setupListeners()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (!this.reconnectTimer) {
        console.log(`[obs] not connected (${message}) — will retry every 5s`)
      }
      this.connected = false
      this.io.emit('obs:status', { connected: false })
      this.scheduleReconnect()
    } finally {
      this.connecting = false
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      void this.openConnection()
    }, 5000)
  }
}
