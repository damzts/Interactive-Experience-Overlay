/**
 * TwitchIrcClient — owns the IRC (wss://irc-ws.chat.twitch.tv) connection
 * lifecycle: connect/reconnect/ping and PRIVMSG parsing. Reports parsed chat
 * messages and connection state via callbacks so it stays independent of the
 * KernelBus / reaction-dispatch concerns that live in the owning manager.
 */

import type { TwitchConfig } from '@ieomlabs/shared'
import logger from '../../../lib/logger.js'

const IRC_URL = 'wss://irc-ws.chat.twitch.tv:443'
const IRC_RETRY_DELAYS_MS = [5_000, 10_000, 30_000, 60_000, 120_000] as const
const PING_INTERVAL_MS = 60_000

export interface TwitchChatMessage {
  user: string
  text: string
  color: string
  badges: string[]
  channel: string
}

export interface TwitchIrcClientCallbacks {
  onConnected(channel: string): void
  onMessage(message: TwitchChatMessage): void
}

export class TwitchIrcClient {
  private ws: WebSocket | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private reconnectAttempt = 0
  private stopped = true

  private _connected = false
  private _authenticated = false
  private _channel = ''

  constructor(private callbacks: TwitchIrcClientCallbacks) {}

  get connected(): boolean { return this._connected }
  /** True once IRC has authenticated with a token (chat:edit scope required
   *  for sends to actually land — Twitch accepts the handshake either way,
   *  so this reflects "we attempted auth", not a verified scope check). */
  get authenticated(): boolean { return this._authenticated }
  get channel(): string { return this._channel }

  connect(cfg: TwitchConfig): void {
    this.stopped = false
    if (this.ws) this.disconnect()
    this._channel = cfg.channel.toLowerCase().replace(/^#/, '')
    logger.info(`[twitch:irc] connecting to #${this._channel}`)

    let WS: typeof WebSocket
    try { WS = WebSocket } catch {
      logger.warn('[twitch:irc] WebSocket unavailable — IRC disabled')
      return
    }

    const ws = new WS(IRC_URL)
    this.ws = ws

    ws.onopen = () => {
      this.reconnectAttempt = 0
      ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands')
      if (cfg.accessToken) {
        ws.send(`PASS oauth:${cfg.accessToken}`)
        ws.send(`NICK ${this._channel}`)
        this._authenticated = true
      } else {
        ws.send(`NICK justinfan${Math.floor(Math.random() * 80000) + 1000}`)
        this._authenticated = false
      }
      ws.send(`JOIN #${this._channel}`)
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

    ws.onerror = (err) => logger.warn({ err }, '[twitch:irc] WebSocket error')

    ws.onclose = () => {
      this._connected = false
      this._authenticated = false
      this.clearPing()
      logger.info('[twitch:irc] WebSocket closed')
      if (!this.stopped) this.scheduleReconnect(cfg)
    }
  }

  disconnect(): void {
    this.stopped = true
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null }
    this.clearPing()
    if (this.ws) { this.ws.onclose = null; this.ws.close(); this.ws = null }
    this._connected = false
    this._authenticated = false
    this._channel = ''
  }

  /**
   * Sends a chat message via IRC PRIVMSG. Requires the IRC connection to be
   * authenticated (config.twitch.accessToken with the chat:edit scope) —
   * anonymous (justinfan) connections can read chat but Twitch silently
   * drops PRIVMSG from them. Returns false without throwing when sending
   * isn't currently possible so callers can no-op safely.
   */
  sendMessage(text: string): boolean {
    const trimmed = text.trim()
    if (!trimmed) return false
    if (!this.ws || this.ws.readyState !== this.ws.OPEN) return false
    if (!this._authenticated || !this._channel) return false
    this.ws.send(`PRIVMSG #${this._channel} :${trimmed}`)
    return true
  }

  private handleLine(line: string): void {
    if (line.startsWith('PING')) {
      this.ws?.send('PONG :tmi.twitch.tv')
      return
    }
    if (line.includes('Login authentication failed') || line.includes('Improperly formatted auth')) {
      logger.warn('[twitch:irc] authentication failed — check accessToken/chat:edit scope; falling back to read-only')
      this._authenticated = false
      return
    }
    if (line.includes('JOIN') && !this._connected) {
      this._connected = true
      logger.info(`[twitch:irc] joined #${this._channel}`)
      this.callbacks.onConnected(this._channel)
      return
    }
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
    this.callbacks.onMessage({ user, text, color, badges, channel })
  }

  private clearPing(): void {
    if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null }
  }

  private scheduleReconnect(cfg: TwitchConfig): void {
    if (this.reconnectTimer) return
    const delay = IRC_RETRY_DELAYS_MS[Math.min(this.reconnectAttempt, IRC_RETRY_DELAYS_MS.length - 1)]!
    this.reconnectAttempt++
    logger.info(`[twitch:irc] reconnecting in ${Math.round(delay / 1000)}s (attempt ${this.reconnectAttempt})`)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (!this.stopped) this.connect(cfg)
    }, delay)
  }
}
