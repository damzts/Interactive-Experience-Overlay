import OBSWebSocket from 'obs-websocket-js'
import type { Server } from 'socket.io'
import type { SceneMachine } from '../state/machine.js'
import { STATE, OVERLAY_EVENT } from '@ieom/shared'

/** Maps OBS hotkey names → IEOM actions */
const OBS_ACTION_MAP: Record<string, (machine: SceneMachine) => void> = {
  'scene:lobby': (m) => m.forceState(STATE.LOBBY),
  'overlay:death':   (m) => m.triggerOverlay({ id: OVERLAY_EVENT.DEATH,   effects: [{ type: 'death-overlay',   cfg: {} }] }),
  'overlay:revive':  (m) => m.triggerOverlay({ id: OVERLAY_EVENT.REVIVE,  effects: [{ type: 'revive-overlay',  cfg: {} }] }),
  'overlay:victory': (m) => m.triggerOverlay({ id: OVERLAY_EVENT.VICTORY, effects: [{ type: 'victory-overlay', cfg: {} }] }),
  'panic': (m) => m.forceState(STATE.LOBBY),
}

export class ObsBridge {
  private obs = new OBSWebSocket()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private connected = false

  constructor(
    private io: Server,
    private machine: SceneMachine,
  ) {}

  connect(url = 'ws://localhost:4455', password = '') {
    this.obs
      .connect(url, password || undefined)
      .then(() => {
        this.connected = true
        console.log('[obs] connected to OBS WebSocket')
        this.io.emit('obs:status', { connected: true })
        this.setupListeners()
      })
      .catch((err: Error) => {
        if (!this.reconnectTimer) {
          // Only log on first failure to avoid spam
          console.log(`[obs] not connected (${err.message}) — will retry every 5s`)
        }
        this.io.emit('obs:status', { connected: false })
        this.scheduleReconnect(url, password)
      })

    this.obs.on('ConnectionClosed', () => {
      if (this.connected) {
        this.connected = false
        console.log('[obs] connection closed')
        this.io.emit('obs:status', { connected: false })
      }
      this.scheduleReconnect(url, password)
    })
  }

  private setupListeners() {
    // Custom hotkey events — user binds hotkeys in OBS settings and maps them here
    // The hotkey names follow OBSBasic.* convention; configure via admin panel in v2
    // For v1 we listen for SceneItemEnableStateChanged as a proxy trigger approach
  }

  private scheduleReconnect(url: string, password: string) {
    if (this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect(url, password)
    }, 5000)
  }
}
