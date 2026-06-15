/**
 * ChatReactionManager — evaluates chat messages against configured rules and fires engine actions.
 *
 * Subscribes to the 'chat:message' custom bus event (emitted by TwitchChatManager and simulation paths).
 * Matches each message against ChatReactionRule entries from AppConfig.chatReactions.
 * Fires matching rules via the 'scheduler:fired' bus event, which the scene handler's
 * registerMachineListeners already processes via executeConfiguredEvent.
 *
 * This keeps ChatReactionManager decoupled from HandlerContext — it only needs the bus.
 */

import type { Manager, ManagerStatus, AppConfig, ChatReactionRule } from '@ieomlabs/shared'
import type { KernelBus } from '../bus.js'
import logger from '../../lib/logger.js'

interface ChatMessage {
  user: string
  text: string
  color: string
  badges: string[]
  channel: string
  source: 'twitch' | 'simulation'
}

export class ChatReactionManager implements Manager {
  readonly name = 'ChatReactionManager'
  readonly bootPriority = 40

  private _status: ManagerStatus = 'idle'
  private _unsubscribe: (() => void) | null = null
  private cooldowns = new Map<string, number>()  // ruleId → last fired timestamp

  constructor(
    private getConfig: () => AppConfig,
    private bus: KernelBus,
  ) {}

  init(): void { this._status = 'idle' }

  start(): void {
    this._unsubscribe = this.bus.on('chat:message', (payload) => {
      this.evaluate(payload)
    })
    this._status = 'running'
  }

  stop(): void {
    this._unsubscribe?.()
    this._unsubscribe = null
    this.cooldowns.clear()
    this._status = 'stopped'
  }

  dispose(): void { this.stop() }
  status(): ManagerStatus { return this._status }

  private evaluate(msg: ChatMessage): void {
    const rules = this.getConfig().chatReactions ?? []
    for (const rule of rules) {
      if (!rule.enabled) continue
      if (!this.matchesText(rule.match, msg.text)) continue
      if (this.isOnCooldown(rule)) continue
      this.fire(rule, msg)
    }
  }

  private matchesText(match: ChatReactionRule['match'], text: string): boolean {
    const t = text.trim()
    switch (match.type) {
      case 'keyword':
        return t.toLowerCase().includes(match.value.toLowerCase())
      case 'command':
        return t.toLowerCase() === `!${match.value.toLowerCase()}` ||
               t.toLowerCase().startsWith(`!${match.value.toLowerCase()} `)
      case 'regex':
        try { return new RegExp(match.value, 'i').test(t) } catch { return false }
    }
  }

  private isOnCooldown(rule: ChatReactionRule): boolean {
    const cooldown = rule.cooldownMs ?? 0
    if (!cooldown) return false
    const last = this.cooldowns.get(rule.id)
    return last !== undefined && Date.now() - last < cooldown
  }

  private fire(rule: ChatReactionRule, msg: ChatMessage): void {
    this.cooldowns.set(rule.id, Date.now())
    logger.info(`[chat-reactions] rule "${rule.label || rule.id}" fired (user: ${msg.user}, text: "${msg.text}")`)

    // For command rules strip the "!command" prefix so {text} is just the message body.
    const textBody = rule.match.type === 'command'
      ? msg.text.slice(rule.match.value.length + 1).trim()
      : msg.text

    this.bus.emit('scheduler:fired', {
      eventId: rule.id,
      event: {
        id: rule.id,
        label: rule.label,
        icon: '',
        color: '',
        desc: '',
        effects: interpolate(rule.effects ?? [], msg, textBody),
        actions: interpolate(rule.actions ?? [], msg, textBody),
        auto: {
          enabled: false,
          mode: 'interval' as const,
          intervalMin: 0,
          idleMin: 0,
          chance: 1,
          cooldownMin: 0,
        },
      },
    })
  }
}

// Deep-walks any value and replaces {{user}}, {{text}}, {{channel}} in all strings.
function interpolate<T>(value: T, msg: ChatMessage, textBody: string = msg.text): T {
  if (typeof value === 'string') {
    return (value as string)
      .replace(/\{\{?user\}?\}/gi, msg.user)
      .replace(/\{\{?text\}?\}/gi, textBody)
      .replace(/\{\{?channel\}?\}/gi, msg.channel) as unknown as T
  }
  if (Array.isArray(value)) return value.map((v) => interpolate(v, msg, textBody)) as unknown as T
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as object).map(([k, v]) => [k, interpolate(v, msg, textBody)])
    ) as unknown as T
  }
  return value
}
