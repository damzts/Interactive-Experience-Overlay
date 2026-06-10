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
    this._unsubscribe = this.bus.onCustom('chat:message', (payload) => {
      this.evaluate(payload as ChatMessage)
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

    // Dispatch via scheduler:fired so the existing scene handler executes it via executeConfiguredEvent.
    // This keeps ChatReactionManager decoupled from HandlerContext and ObsBridge.
    this.bus.emit('scheduler:fired', {
      eventId: rule.id,
      event: {
        id: rule.id,
        label: rule.label,
        icon: '',
        color: '',
        desc: '',
        effects: rule.effects ?? [],
        actions: rule.actions ?? [],
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
