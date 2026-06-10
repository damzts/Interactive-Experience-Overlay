/**
 * TwitchChatManager — connects to Twitch IRC over WebSocket (read-only, anonymous or authenticated).
 *
 * Uses the Twitch IRC-over-WebSocket endpoint (wss://irc-ws.chat.twitch.tv:443).
 * With `justinfan<random>` as the nick, no OAuth token is needed for public channels.
 * When an accessToken is configured, authenticated mode is used instead.
 *
 * On each PRIVMSG the manager emits bus.emitCustom('chat:message', payload).
 * This flows to overlay clients automatically via the existing onAny/bus:custom forwarder.
 *
 * The overlay ChatWidget subscribes to 'bus:custom' for 'chat:message' events.
 */

import type { Manager, ManagerStatus, AppConfig, TwitchConfig } from '@ieomlabs/shared'
import type { KernelBus } from '../bus.js'
import logger from '../../lib/logger.js'

const RETRY_DELAYS_MS = [5_000, 10_000, 30_000, 60_000, 120_000] as const
const TWITCH_IRC_URL = 'wss://irc-ws.chat.twitch.tv:443'
const PING_INTERVAL_MS = 60_000

export class TwitchChatManager implements Manager {
  readonly name = 'TwitchChatManager'
  readonly bootPriority = 30

  private _status: ManagerStatus = 'idle'
  private ws: WebSocket | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private reconnectAttempt = 0
  private _connected = false
  private _channel = ''

  constructor(
    private getConfig: () => AppConfig,
    private bus: KernelBus,
  ) {}

  init(): void { this._status = 'idle' }

  start(): void {
    this._status = 'running'
    const cfg = this.getConfig().twitch
    if (cfg?.enabled && cfg.channel) {
      this.connect(cfg)
    }
  }

  stop(): void {
    this.disconnect()
    this._status = 'stopped'
  }

  dispose(): void { this.stop() }
  status(): ManagerStatus { return this._status }

  onConfigChange(config: AppConfig): void {
    const cfg = config.twitch
    if (cfg?.enabled && cfg.channel) {
      // Reconnect if channel changed
      if (cfg.channel !== this._channel) {
        this.disconnect()
        this.connect(cfg)
      }
    } else {
      this.disconnect()
    }
  }

  get isConnected(): boolean { return this._connected }
  get channel(): string { return this._channel }

  private connect(cfg: TwitchConfig): void {
    if (this.ws) this.disconnect()

    this._channel = cfg.channel.toLowerCase().replace(/^#/, '')
    logger.info(`[twitch] connecting to #${this._channel}`)

    // Use native WebSocket (available in Node.js 21+) or fallback
    let WS: typeof WebSocket
    try {
      WS = WebSocket
    } catch {
      logger.warn('[twitch] WebSocket not available in this Node version — Twitch chat disabled')
      return
    }

    const ws = new WS(TWITCH_IRC_URL)
    this.ws = ws

    ws.onopen = () => {
      logger.info('[twitch] WebSocket connected — authenticating')
      this.reconnectAttempt = 0

      // Request IRCv3 tags for display-name, color, badges
      ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands')

      if (cfg.accessToken) {
        ws.send(`PASS oauth:${cfg.accessToken}`)
        ws.send(`NICK ${this._channel}`)
      } else {
        // Anonymous read-only access with a justinfan nick
        const anonNick = `justinfan${Math.floor(Math.random() * 80000) + 1000}`
        ws.send(`NICK ${anonNick}`)
      }

      ws.send(`JOIN #${this._channel}`)

      // Keep-alive ping
      this.pingTimer = setInterval(() => {
        if (ws.readyState === ws.OPEN) ws.send('PING :tmi.twitch.tv')
      }, PING_INTERVAL_MS)
    }

    ws.onmessage = (event) => {
      const raw = typeof event.data === 'string' ? event.data : ''
      for (const line of raw.split('\r\n')) {
        if (line) this.handleLine(line)
      }
    }

    ws.onerror = (err) => {
      logger.warn({ err }, '[twitch] WebSocket error')
    }

    ws.onclose = () => {
      this._connected = false
      this.clearPing()
      logger.info('[twitch] WebSocket closed')
      if (this._status === 'running') this.scheduleReconnect(cfg)
    }
  }

  private handleLine(line: string): void {
    // Handle PING to keep connection alive
    if (line.startsWith('PING')) {
      this.ws?.send('PONG :tmi.twitch.tv')
      return
    }

    // Mark as connected once we see a successful JOIN
    if (line.includes('JOIN')) {
      if (!this._connected) {
        this._connected = true
        logger.info(`[twitch] joined #${this._channel}`)
        this.bus.emitCustom('chat:connected', { channel: this._channel })
      }
      return
    }

    // Parse PRIVMSG — Twitch IRC format:
    // @color=#FF0000;display-name=User;badges=... :user!user@user.tmi.twitch.tv PRIVMSG #channel :message
    const match = line.match(/^@([^ ]+) :[^!]+![^ ]+ PRIVMSG #(\S+) :(.+)$/)
    if (!match) return

    const tagStr = match[1]!
    const channel = match[2]!
    const text = match[3]!.trimEnd()

    const tags: Record<string, string> = {}
    for (const part of tagStr.split(';')) {
      const eq = part.indexOf('=')
      if (eq >= 0) tags[part.slice(0, eq)] = part.slice(eq + 1)
    }

    const user = tags['display-name'] || 'unknown'
    const color = tags['color'] || '#ffffff'
    const badges = (tags['badges'] || '').split(',').filter(Boolean)

    this.bus.emitCustom('chat:message', { user, text, color, badges, channel, source: 'twitch' })
  }

  private disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.clearPing()
    if (this.ws) {
      this.ws.onclose = null // prevent reconnect on intentional close
      this.ws.close()
      this.ws = null
    }
    this._connected = false
    this._channel = ''
  }

  private clearPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }
  }

  private scheduleReconnect(cfg: TwitchConfig): void {
    if (this.reconnectTimer) return
    const delayMs = RETRY_DELAYS_MS[Math.min(this.reconnectAttempt, RETRY_DELAYS_MS.length - 1)]!
    this.reconnectAttempt += 1
    logger.info(`[twitch] reconnecting in ${Math.round(delayMs / 1000)}s (attempt ${this.reconnectAttempt})`)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (this._status === 'running') this.connect(cfg)
    }, delayMs)
  }
}
