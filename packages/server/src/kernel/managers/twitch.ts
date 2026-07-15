/**
 * TwitchIntegrationManager — unified Twitch integration: IRC chat + EventSub.
 *
 * Delegates the two WebSocket connection lifecycles to dedicated clients:
 *   • TwitchIrcClient — IRC chat (PRIVMSG parsing, reconnect, ping)
 *   • TwitchEventSubClient — EventSub session/subscription/reconnect handling
 *
 * This manager owns what's specific to the *product*: mapping EventSub
 * notifications onto KernelBus signals, and firing per-event chat-reaction
 * rules (config.twitch.eventReactions).
 *
 * EventSub only activates when both `accessToken` and `clientId` are configured.
 * IRC works with token only (or anonymous via justinfan nick).
 */

import type { Manager, ManagerStatus, AppConfig, TwitchConfig, TwitchEventReaction, TwitchEventKind } from '@ieomlabs/shared'
import type { KernelBus } from '../bus.js'
import { TwitchIrcClient } from './twitch/ircClient.js'
import { TwitchEventSubClient } from './twitch/eventSubClient.js'

const EVENTSUB_URL = 'wss://eventsub.wss.twitch.tv/ws'

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

  private readonly irc = new TwitchIrcClient({
    onConnected: (channel) => this.bus.emit('chat:connected', { channel }),
    onMessage: (message) => this.bus.emit('chat:message', { ...message, source: 'twitch' }),
  })

  private readonly eventSub = new TwitchEventSubClient({
    onConnected: (sessionId) => this.bus.emit('twitch:eventsub:connected', { sessionId }),
    onNotification: (subType, eventData) => this.handleNotification(subType, eventData, this.getConfig().twitch!),
  })

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
      this.irc.connect(cfg)
      if (cfg.accessToken && cfg.clientId) {
        this.eventSub.connect(cfg, EVENTSUB_URL)
      }
    }
    this._unsubscribeChatSend = this.bus.on('twitch:chat:send', ({ text }) => {
      this.sendMessage(text)
    })
  }

  stop(): void {
    this.irc.disconnect()
    this.eventSub.disconnect()
    this._unsubscribeChatSend?.()
    this._unsubscribeChatSend = null
    this._status = 'stopped'
  }

  dispose(): void { this.stop() }
  status(): ManagerStatus { return this._status }

  get isConnected(): boolean { return this.irc.connected }
  get isEventSubConnected(): boolean { return this.eventSub.connected }
  get channel(): string { return this.irc.channel }
  /** True once IRC has authenticated with a token (chat:edit scope required
   *  for sends to actually land — Twitch accepts the handshake either way,
   *  so this reflects "we attempted auth", not a verified scope check). */
  get canSendChat(): boolean { return this.irc.authenticated && this.irc.connected }

  /**
   * Sends a chat message via IRC PRIVMSG. Requires the IRC connection to be
   * authenticated (config.twitch.accessToken with the chat:edit scope) —
   * anonymous (justinfan) connections can read chat but Twitch silently
   * drops PRIVMSG from them. Returns false without throwing when sending
   * isn't currently possible (not connected, or connected anonymously) so
   * callers (catalog action, persona replies) can no-op safely.
   */
  sendMessage(text: string): boolean {
    return this.irc.sendMessage(text)
  }

  onConfigChange(config: AppConfig): void {
    const cfg = config.twitch
    if (cfg?.enabled && cfg.channel) {
      // Reconnect IRC if channel changed OR if we aren't connected yet
      if (cfg.channel !== this.irc.channel || !this.irc.connected) {
        this.irc.disconnect()
        this.irc.connect(cfg)
      }
      const wantsEventSub = !!(cfg.accessToken && cfg.clientId)
      if (!wantsEventSub) {
        this.eventSub.disconnect()
      } else if (!this.eventSub.connected) {
        this.eventSub.connect(cfg, EVENTSUB_URL)
      }
    } else {
      this.irc.disconnect()
      this.eventSub.disconnect()
    }
  }

  // ── EventSub notification → KernelBus signal mapping ────────────────────

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
