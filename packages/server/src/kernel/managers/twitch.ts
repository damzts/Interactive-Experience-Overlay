/**
 * TwitchIntegrationManager — unified Twitch integration: IRC chat + EventSub.
 *
 * Maintains two WebSocket connections sharing the same config:
 *   • IRC (wss://irc-ws.chat.twitch.tv) — PRIVMSG → chat:message bus events
 *   • EventSub (wss://eventsub.wss.twitch.tv/ws) — channel events → twitch:* bus events
 *
 * EventSub only activates when both `accessToken` and `clientId` are configured.
 * IRC works with token only (or anonymous via justinfan nick).
 *
 * All events hit the KernelBus first. The socket transport bridges them to clients.
 * Per-event reactions in config.twitch.eventReactions are fired inline here.
 */

import type { Manager, ManagerStatus, AppConfig, TwitchConfig, TwitchEventReaction, TwitchEventKind } from '@ieomlabs/shared'
import type { KernelBus } from '../bus.js'
import logger from '../../lib/logger.js'

const IRC_URL = 'wss://irc-ws.chat.twitch.tv:443'
const EVENTSUB_URL = 'wss://eventsub.wss.twitch.tv/ws'
const TWITCH_API = 'https://api.twitch.tv/helix'
const IRC_RETRY_DELAYS_MS = [5_000, 10_000, 30_000, 60_000, 120_000] as const
const EVENTSUB_RETRY_DELAYS_MS = [5_000, 10_000, 30_000, 60_000, 120_000] as const
const PING_INTERVAL_MS = 60_000

// Maps EventSub subscription types to our TwitchEventKind
const SUB_TYPE_TO_KIND: Record<string, TwitchEventKind> = {
  'channel.follow':                                       'follow',
  'channel.subscribe':                                    'subscribe',
  'channel.subscription.gift':                            'gift-sub',
  'channel.cheer':                                        'cheer',
  'channel.raid':                                         'raid',
  'channel.channel_points_custom_reward_redemption.add':  'points-redemption',
  'stream.online':                                        'stream-online',
  'stream.offline':                                       'stream-offline',
  'channel.hype_train.begin':                             'hype-train-begin',
  'channel.hype_train.end':                               'hype-train-end',
}

export class TwitchIntegrationManager implements Manager {
  readonly name = 'TwitchIntegrationManager'
  readonly bootPriority = 30

  private _status: ManagerStatus = 'idle'

  // IRC state
  private ircWs: WebSocket | null = null
  private ircReconnectTimer: ReturnType<typeof setTimeout> | null = null
  private ircPingTimer: ReturnType<typeof setInterval> | null = null
  private ircReconnectAttempt = 0
  private _ircConnected = false
  private _ircAuthenticated = false
  private _channel = ''

  // EventSub state
  private eventSubWs: WebSocket | null = null
  private eventSubReconnectTimer: ReturnType<typeof setTimeout> | null = null
  private eventSubReconnectAttempt = 0
  private _eventSubConnected = false
  private _sessionId: string | null = null

  private _unsubscribeChatSend: (() => void) | null = null

  constructor(
    private getConfig: () => AppConfig,
    private bus: KernelBus,
  ) {}

  init(): void { this._status = 'idle' }

  start(): void {
    this._status = 'running'
    const cfg = this.getConfig().twitch
    if (cfg?.enabled && cfg.channel) {
      this.connectIrc(cfg)
      if (cfg.accessToken && cfg.clientId) {
        this.connectEventSub(cfg, EVENTSUB_URL)
      }
    }
    this._unsubscribeChatSend = this.bus.on('twitch:chat:send', ({ text }) => {
      this.sendMessage(text)
    })
  }

  stop(): void {
    this.disconnectIrc()
    this.disconnectEventSub()
    this._unsubscribeChatSend?.()
    this._unsubscribeChatSend = null
    this._status = 'stopped'
  }

  dispose(): void { this.stop() }
  status(): ManagerStatus { return this._status }

  get isConnected(): boolean { return this._ircConnected }
  get isEventSubConnected(): boolean { return this._eventSubConnected }
  get channel(): string { return this._channel }
  /** True once IRC has authenticated with a token (chat:edit scope required
   *  for sends to actually land — Twitch accepts the handshake either way,
   *  so this reflects "we attempted auth", not a verified scope check). */
  get canSendChat(): boolean { return this._ircAuthenticated && this._ircConnected }

  /**
   * Sends a chat message via IRC PRIVMSG. Requires the IRC connection to be
   * authenticated (config.twitch.accessToken with the chat:edit scope) —
   * anonymous (justinfan) connections can read chat but Twitch silently
   * drops PRIVMSG from them. Returns false without throwing when sending
   * isn't currently possible (not connected, or connected anonymously) so
   * callers (catalog action, persona replies) can no-op safely.
   */
  sendMessage(text: string): boolean {
    const trimmed = text.trim()
    if (!trimmed) return false
    if (!this.ircWs || this.ircWs.readyState !== this.ircWs.OPEN) return false
    if (!this._ircAuthenticated || !this._channel) return false
    this.ircWs.send(`PRIVMSG #${this._channel} :${trimmed}`)
    return true
  }

  onConfigChange(config: AppConfig): void {
    const cfg = config.twitch
    if (cfg?.enabled && cfg.channel) {
      // Reconnect IRC if channel changed OR if we aren't connected yet
      if (cfg.channel !== this._channel || !this._ircConnected) {
        this.disconnectIrc()
        this.connectIrc(cfg)
      }
      const wantsEventSub = !!(cfg.accessToken && cfg.clientId)
      if (!wantsEventSub) {
        this.disconnectEventSub()
      } else if (!this._eventSubConnected) {
        this.connectEventSub(cfg, EVENTSUB_URL)
      }
    } else {
      this.disconnectIrc()
      this.disconnectEventSub()
    }
  }

  // ── IRC ────────────────────────────────────────────────────────────────────

  private connectIrc(cfg: TwitchConfig): void {
    if (this.ircWs) this.disconnectIrc()
    this._channel = cfg.channel.toLowerCase().replace(/^#/, '')
    logger.info(`[twitch:irc] connecting to #${this._channel}`)

    let WS: typeof WebSocket
    try { WS = WebSocket } catch {
      logger.warn('[twitch:irc] WebSocket unavailable — IRC disabled')
      return
    }

    const ws = new WS(IRC_URL)
    this.ircWs = ws

    ws.onopen = () => {
      this.ircReconnectAttempt = 0
      ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands')
      if (cfg.accessToken) {
        ws.send(`PASS oauth:${cfg.accessToken}`)
        ws.send(`NICK ${this._channel}`)
        this._ircAuthenticated = true
      } else {
        ws.send(`NICK justinfan${Math.floor(Math.random() * 80000) + 1000}`)
        this._ircAuthenticated = false
      }
      ws.send(`JOIN #${this._channel}`)
      this.ircPingTimer = setInterval(() => {
        if (ws.readyState === ws.OPEN) ws.send('PING :tmi.twitch.tv')
      }, PING_INTERVAL_MS)
    }

    ws.onmessage = (event) => {
      const raw = typeof event.data === 'string' ? event.data : ''
      for (const line of raw.split('\r\n')) {
        if (line) this.handleIrcLine(line)
      }
    }

    ws.onerror = (err) => logger.warn({ err }, '[twitch:irc] WebSocket error')

    ws.onclose = () => {
      this._ircConnected = false
      this._ircAuthenticated = false
      this.clearIrcPing()
      logger.info('[twitch:irc] WebSocket closed')
      if (this._status === 'running') this.scheduleIrcReconnect(cfg)
    }
  }

  private handleIrcLine(line: string): void {
    if (line.startsWith('PING')) {
      this.ircWs?.send('PONG :tmi.twitch.tv')
      return
    }
    if (line.includes('Login authentication failed') || line.includes('Improperly formatted auth')) {
      logger.warn('[twitch:irc] authentication failed — check accessToken/chat:edit scope; falling back to read-only')
      this._ircAuthenticated = false
      return
    }
    if (line.includes('JOIN') && !this._ircConnected) {
      this._ircConnected = true
      logger.info(`[twitch:irc] joined #${this._channel}`)
      this.bus.emit('chat:connected', { channel: this._channel })
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
    this.bus.emit('chat:message', { user, text, color, badges, channel, source: 'twitch' })
  }

  private disconnectIrc(): void {
    if (this.ircReconnectTimer) { clearTimeout(this.ircReconnectTimer); this.ircReconnectTimer = null }
    this.clearIrcPing()
    if (this.ircWs) { this.ircWs.onclose = null; this.ircWs.close(); this.ircWs = null }
    this._ircConnected = false
    this._ircAuthenticated = false
    this._channel = ''
  }

  private clearIrcPing(): void {
    if (this.ircPingTimer) { clearInterval(this.ircPingTimer); this.ircPingTimer = null }
  }

  private scheduleIrcReconnect(cfg: TwitchConfig): void {
    if (this.ircReconnectTimer) return
    const delay = IRC_RETRY_DELAYS_MS[Math.min(this.ircReconnectAttempt, IRC_RETRY_DELAYS_MS.length - 1)]!
    this.ircReconnectAttempt++
    logger.info(`[twitch:irc] reconnecting in ${Math.round(delay / 1000)}s (attempt ${this.ircReconnectAttempt})`)
    this.ircReconnectTimer = setTimeout(() => {
      this.ircReconnectTimer = null
      if (this._status === 'running') this.connectIrc(cfg)
    }, delay)
  }

  // ── EventSub ───────────────────────────────────────────────────────────────

  private connectEventSub(cfg: TwitchConfig, url: string): void {
    if (this.eventSubWs) this.disconnectEventSub()
    logger.info('[twitch:eventsub] connecting')

    let WS: typeof WebSocket
    try { WS = WebSocket } catch {
      logger.warn('[twitch:eventsub] WebSocket unavailable — EventSub disabled')
      return
    }

    const ws = new WS(url)
    this.eventSubWs = ws

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(typeof event.data === 'string' ? event.data : '{}') as Record<string, unknown>
        this.handleEventSubMessage(msg, cfg)
      } catch {
        // ignore malformed frames
      }
    }

    ws.onerror = (err) => logger.warn({ err }, '[twitch:eventsub] WebSocket error')

    ws.onclose = () => {
      this._eventSubConnected = false
      this._sessionId = null
      logger.info('[twitch:eventsub] WebSocket closed')
      if (this._status === 'running') this.scheduleEventSubReconnect(cfg)
    }
  }

  private handleEventSubMessage(msg: Record<string, unknown>, cfg: TwitchConfig): void {
    const metadata = msg['metadata'] as Record<string, unknown> | undefined
    const payload = msg['payload'] as Record<string, unknown> | undefined
    const msgType = metadata?.['message_type'] as string | undefined

    if (msgType === 'session_welcome') {
      const session = (payload?.['session'] ?? {}) as Record<string, unknown>
      const sessionId = session['id'] as string
      this._sessionId = sessionId
      this._eventSubConnected = true
      this.eventSubReconnectAttempt = 0
      logger.info(`[twitch:eventsub] session welcome — id: ${sessionId}`)
      this.bus.emit('twitch:eventsub:connected', { sessionId })
      void this.subscribeAll(sessionId, cfg)
      return
    }

    if (msgType === 'session_keepalive') return

    if (msgType === 'session_reconnect') {
      const session = (payload?.['session'] ?? {}) as Record<string, unknown>
      const reconnectUrl = session['reconnect_url'] as string | undefined
      if (reconnectUrl) {
        logger.info(`[twitch:eventsub] reconnect requested → ${reconnectUrl}`)
        if (this.eventSubWs) { this.eventSubWs.onclose = null; this.eventSubWs.close(); this.eventSubWs = null }
        this.connectEventSub(cfg, reconnectUrl)
      }
      return
    }

    if (msgType === 'notification') {
      const subscription = (payload?.['subscription'] ?? {}) as Record<string, unknown>
      const eventData = (payload?.['event'] ?? {}) as Record<string, unknown>
      const subType = subscription['type'] as string | undefined
      if (subType) this.handleNotification(subType, eventData, cfg)
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

  private handleNotification(subType: string, eventData: Record<string, unknown>, cfg: TwitchConfig): void {
    const kind = SUB_TYPE_TO_KIND[subType]
    if (!kind) return

    switch (kind) {
      case 'follow':
        this.bus.emit('twitch:follow', {
          user: String(eventData['user_name'] ?? ''),
          userId: String(eventData['user_id'] ?? ''),
        })
        this.fireEventReaction(kind, { user: String(eventData['user_name'] ?? '') }, cfg)
        break

      case 'subscribe':
        this.bus.emit('twitch:subscribe', {
          user: String(eventData['user_name'] ?? ''),
          userId: String(eventData['user_id'] ?? ''),
          tier: String(eventData['tier'] ?? '1000'),
          isGift: Boolean(eventData['is_gift']),
        })
        this.fireEventReaction(kind, {
          user: String(eventData['user_name'] ?? ''),
          tier: String(eventData['tier'] ?? '1000'),
        }, cfg)
        break

      case 'gift-sub':
        this.bus.emit('twitch:gift-sub', {
          gifter: String(eventData['user_name'] ?? 'anonymous'),
          gifterId: String(eventData['user_id'] ?? ''),
          tier: String(eventData['tier'] ?? '1000'),
          total: Number(eventData['total'] ?? 1),
          cumulative: eventData['cumulative_total'] != null ? Number(eventData['cumulative_total']) : undefined,
        })
        this.fireEventReaction(kind, {
          gifter: String(eventData['user_name'] ?? 'anonymous'),
          total: String(eventData['total'] ?? '1'),
          tier: String(eventData['tier'] ?? '1000'),
        }, cfg)
        break

      case 'cheer': {
        const isAnon = Boolean(eventData['is_anonymous'])
        this.bus.emit('twitch:cheer', {
          user: isAnon ? 'anonymous' : String(eventData['user_name'] ?? ''),
          userId: isAnon ? undefined : String(eventData['user_id'] ?? ''),
          bits: Number(eventData['bits'] ?? 0),
          message: String(eventData['message'] ?? ''),
          isAnonymous: isAnon,
        })
        this.fireEventReaction(kind, {
          user: isAnon ? 'anonymous' : String(eventData['user_name'] ?? ''),
          bits: String(eventData['bits'] ?? '0'),
          message: String(eventData['message'] ?? ''),
        }, cfg)
        break
      }

      case 'raid':
        this.bus.emit('twitch:raid', {
          from: String(eventData['from_broadcaster_user_name'] ?? ''),
          fromId: String(eventData['from_broadcaster_user_id'] ?? ''),
          viewers: Number(eventData['viewers'] ?? 0),
        })
        this.fireEventReaction(kind, {
          from: String(eventData['from_broadcaster_user_name'] ?? ''),
          viewers: String(eventData['viewers'] ?? '0'),
        }, cfg)
        break

      case 'points-redemption':
        this.bus.emit('twitch:points:redemption', {
          user: String(eventData['user_name'] ?? ''),
          userId: String(eventData['user_id'] ?? ''),
          rewardId: String((eventData['reward'] as Record<string, unknown>)?.['id'] ?? ''),
          rewardTitle: String((eventData['reward'] as Record<string, unknown>)?.['title'] ?? ''),
          input: String(eventData['user_input'] ?? ''),
        })
        this.fireEventReaction(kind, {
          user: String(eventData['user_name'] ?? ''),
          reward: String((eventData['reward'] as Record<string, unknown>)?.['title'] ?? ''),
          input: String(eventData['user_input'] ?? ''),
        }, cfg)
        break

      case 'stream-online':
        this.bus.emit('twitch:stream:online', { startedAt: String(eventData['started_at'] ?? '') })
        this.fireEventReaction(kind, {}, cfg)
        break

      case 'stream-offline':
        this.bus.emit('twitch:stream:offline', {})
        this.fireEventReaction(kind, {}, cfg)
        break

      case 'hype-train-begin':
        this.bus.emit('twitch:hype-train:begin', {
          level: Number(eventData['level'] ?? 1),
          total: Number(eventData['total'] ?? 0),
          goal: Number(eventData['goal'] ?? 0),
        })
        this.fireEventReaction(kind, {
          level: String(eventData['level'] ?? '1'),
        }, cfg)
        break

      case 'hype-train-end':
        this.bus.emit('twitch:hype-train:end', {
          level: Number(eventData['level'] ?? 1),
          total: Number(eventData['total'] ?? 0),
        })
        this.fireEventReaction(kind, {
          level: String(eventData['level'] ?? '1'),
        }, cfg)
        break
    }
  }

  private fireEventReaction(kind: TwitchEventKind, vars: Record<string, string>, cfg: TwitchConfig): void {
    const reaction = (cfg.eventReactions ?? []).find((r) => r.event === kind && r.enabled)
    if (!reaction) return

    this.bus.emit('scheduler:fired', {
      eventId: `twitch:${kind}`,
      event: {
        id: `twitch:${kind}`,
        label: kind,
        icon: '',
        color: '',
        desc: '',
        effects: interpolateReaction(reaction.effects ?? [], vars),
        actions: interpolateReaction(reaction.actions ?? [], vars),
        auto: { enabled: false, mode: 'interval' as const, intervalMin: 0, idleMin: 0, chance: 1, cooldownMin: 0 },
      },
    })
  }

  private disconnectEventSub(): void {
    if (this.eventSubReconnectTimer) { clearTimeout(this.eventSubReconnectTimer); this.eventSubReconnectTimer = null }
    if (this.eventSubWs) { this.eventSubWs.onclose = null; this.eventSubWs.close(); this.eventSubWs = null }
    this._eventSubConnected = false
    this._sessionId = null
  }

  private scheduleEventSubReconnect(cfg: TwitchConfig): void {
    if (this.eventSubReconnectTimer) return
    const delay = EVENTSUB_RETRY_DELAYS_MS[Math.min(this.eventSubReconnectAttempt, EVENTSUB_RETRY_DELAYS_MS.length - 1)]!
    this.eventSubReconnectAttempt++
    logger.info(`[twitch:eventsub] reconnecting in ${Math.round(delay / 1000)}s (attempt ${this.eventSubReconnectAttempt})`)
    this.eventSubReconnectTimer = setTimeout(() => {
      this.eventSubReconnectTimer = null
      if (this._status === 'running') this.connectEventSub(cfg, EVENTSUB_URL)
    }, delay)
  }
}

function interpolateReaction<T>(value: T, vars: Record<string, string>): T {
  if (typeof value === 'string') {
    let s = value as string
    for (const [k, v] of Object.entries(vars)) {
      s = s.replace(new RegExp(`\\{\\{?${k}\\}?\\}`, 'gi'), v)
    }
    return s as unknown as T
  }
  if (Array.isArray(value)) return value.map((v) => interpolateReaction(v, vars)) as unknown as T
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as object).map(([k, v]) => [k, interpolateReaction(v, vars)])
    ) as unknown as T
  }
  return value
}
