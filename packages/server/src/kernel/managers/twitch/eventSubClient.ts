/**
 * TwitchEventSubClient — owns the EventSub (wss://eventsub.wss.twitch.tv/ws)
 * connection lifecycle: session handshake, subscription registration, and
 * reconnect/keepalive handling. Reports parsed notifications via callback so
 * event-kind mapping and bus emission stay in the owning manager.
 */

import type { TwitchConfig } from '@ieomlabs/shared'
import logger from '../../../lib/logger.js'

const EVENTSUB_URL = 'wss://eventsub.wss.twitch.tv/ws'
const TWITCH_API = 'https://api.twitch.tv/helix'
const EVENTSUB_RETRY_DELAYS_MS = [5_000, 10_000, 30_000, 60_000, 120_000] as const

export interface TwitchEventSubClientCallbacks {
  onConnected(sessionId: string): void
  onNotification(subType: string, eventData: Record<string, unknown>): void
}

export class TwitchEventSubClient {
  private ws: WebSocket | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempt = 0
  private stopped = true

  private _connected = false
  private sessionId: string | null = null

  constructor(private callbacks: TwitchEventSubClientCallbacks) {}

  get connected(): boolean { return this._connected }

  connect(cfg: TwitchConfig, url: string = EVENTSUB_URL): void {
    this.stopped = false
    if (this.ws) this.disconnect()
    logger.info('[twitch:eventsub] connecting')

    let WS: typeof WebSocket
    try { WS = WebSocket } catch {
      logger.warn('[twitch:eventsub] WebSocket unavailable — EventSub disabled')
      return
    }

    const ws = new WS(url)
    this.ws = ws

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(typeof event.data === 'string' ? event.data : '{}') as Record<string, unknown>
        this.handleMessage(msg, cfg)
      } catch {
        // ignore malformed frames
      }
    }

    ws.onerror = (err) => logger.warn({ err }, '[twitch:eventsub] WebSocket error')

    ws.onclose = () => {
      this._connected = false
      this.sessionId = null
      logger.info('[twitch:eventsub] WebSocket closed')
      if (!this.stopped) this.scheduleReconnect(cfg)
    }
  }

  disconnect(): void {
    this.stopped = true
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null }
    if (this.ws) { this.ws.onclose = null; this.ws.close(); this.ws = null }
    this._connected = false
    this.sessionId = null
  }

  private handleMessage(msg: Record<string, unknown>, cfg: TwitchConfig): void {
    const metadata = msg['metadata'] as Record<string, unknown> | undefined
    const payload = msg['payload'] as Record<string, unknown> | undefined
    const msgType = metadata?.['message_type'] as string | undefined

    if (msgType === 'session_welcome') {
      const session = (payload?.['session'] ?? {}) as Record<string, unknown>
      const sessionId = session['id'] as string
      this.sessionId = sessionId
      this._connected = true
      this.reconnectAttempt = 0
      logger.info(`[twitch:eventsub] session welcome — id: ${sessionId}`)
      this.callbacks.onConnected(sessionId)
      void this.subscribeAll(sessionId, cfg)
      return
    }

    if (msgType === 'session_keepalive') return

    if (msgType === 'session_reconnect') {
      const session = (payload?.['session'] ?? {}) as Record<string, unknown>
      const reconnectUrl = session['reconnect_url'] as string | undefined
      if (reconnectUrl) {
        logger.info(`[twitch:eventsub] reconnect requested → ${reconnectUrl}`)
        if (this.ws) { this.ws.onclose = null; this.ws.close(); this.ws = null }
        this.connect(cfg, reconnectUrl)
      }
      return
    }

    if (msgType === 'notification') {
      const subscription = (payload?.['subscription'] ?? {}) as Record<string, unknown>
      const eventData = (payload?.['event'] ?? {}) as Record<string, unknown>
      const subType = subscription['type'] as string | undefined
      if (subType) this.callbacks.onNotification(subType, eventData)
    }
  }

  private async subscribeAll(sessionId: string, cfg: TwitchConfig): Promise<void> {
    if (!cfg.accessToken || !cfg.clientId) return

    // Resolve broadcaster user ID from channel name
    let broadcasterId: string
    try {
      const res = await fetch(`${TWITCH_API}/users?login=${encodeURIComponent(cfg.channel)}`, {
        headers: {
          'Authorization': `Bearer ${cfg.accessToken}`,
          'Client-Id': cfg.clientId,
        },
      })
      const json = await res.json() as { data?: Array<{ id: string }> }
      const userId = json.data?.[0]?.id
      if (!userId) {
        logger.warn(`[twitch:eventsub] could not resolve user ID for channel "${cfg.channel}"`)
        return
      }
      broadcasterId = userId
    } catch (err) {
      logger.warn({ err }, '[twitch:eventsub] failed to resolve broadcaster ID')
      return
    }

    const transport = { method: 'websocket', session_id: sessionId }
    const headers = {
      'Authorization': `Bearer ${cfg.accessToken}`,
      'Client-Id': cfg.clientId,
      'Content-Type': 'application/json',
    }

    const subscriptions: Array<{ type: string; version: string; condition: Record<string, string> }> = [
      { type: 'channel.follow',           version: '2', condition: { broadcaster_user_id: broadcasterId, moderator_user_id: broadcasterId } },
      { type: 'channel.subscribe',         version: '1', condition: { broadcaster_user_id: broadcasterId } },
      { type: 'channel.subscription.gift', version: '1', condition: { broadcaster_user_id: broadcasterId } },
      { type: 'channel.cheer',             version: '1', condition: { broadcaster_user_id: broadcasterId } },
      { type: 'channel.raid',              version: '1', condition: { to_broadcaster_user_id: broadcasterId } },
      { type: 'channel.channel_points_custom_reward_redemption.add', version: '1', condition: { broadcaster_user_id: broadcasterId } },
      { type: 'stream.online',             version: '1', condition: { broadcaster_user_id: broadcasterId } },
      { type: 'stream.offline',            version: '1', condition: { broadcaster_user_id: broadcasterId } },
      { type: 'channel.hype_train.begin',  version: '1', condition: { broadcaster_user_id: broadcasterId } },
      { type: 'channel.hype_train.end',    version: '1', condition: { broadcaster_user_id: broadcasterId } },
    ]

    for (const sub of subscriptions) {
      try {
        const res = await fetch(`${TWITCH_API}/eventsub/subscriptions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ ...sub, transport }),
        })
        if (res.ok || res.status === 409) {
          // 409 = already subscribed (fine)
          logger.info(`[twitch:eventsub] subscribed to ${sub.type}`)
        } else {
          const body = await res.text()
          logger.warn(`[twitch:eventsub] failed to subscribe to ${sub.type}: ${res.status} ${body}`)
        }
      } catch (err) {
        logger.warn({ err }, `[twitch:eventsub] error subscribing to ${sub.type}`)
      }
    }
  }

  private scheduleReconnect(cfg: TwitchConfig): void {
    if (this.reconnectTimer) return
    const delay = EVENTSUB_RETRY_DELAYS_MS[Math.min(this.reconnectAttempt, EVENTSUB_RETRY_DELAYS_MS.length - 1)]!
    this.reconnectAttempt++
    logger.info(`[twitch:eventsub] reconnecting in ${Math.round(delay / 1000)}s (attempt ${this.reconnectAttempt})`)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (!this.stopped) this.connect(cfg, EVENTSUB_URL)
    }, delay)
  }
}
