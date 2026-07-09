/**
 * PersonaManager — chat-to-voice companion (see @ieomlabs/shared PersonaConfig doc comment).
 *
 * Subscribes to the 'chat:message' bus event (emitted by TwitchIntegrationManager
 * and simulation paths), picks a candidate message per PersonaConfig.triggerMode,
 * synthesizes it via TtsService, and emits the public 'persona:speak' kernel
 * signal so the overlay can play it and show a caption.
 *
 * Mirrors ChatReactionManager's shape: reads config fresh on every message
 * rather than caching it, and stays decoupled from HandlerContext.
 */
import type { Manager, ManagerStatus, AppConfig, ChatMessagePayload } from '@ieomlabs/shared'
import { withPersonaDefaults } from '@ieomlabs/shared'
import type { KernelBus } from '../bus.js'
import type { TtsService } from '../../services/TtsService.js'
import logger from '../../lib/logger.js'

export class PersonaManager implements Manager {
  readonly name = 'PersonaManager'
  readonly bootPriority = 40

  private _status: ManagerStatus = 'idle'
  private _unsubscribe: (() => void) | null = null
  private lastSpokenAt = 0

  constructor(
    private getConfig: () => AppConfig,
    private bus: KernelBus,
    private tts: TtsService,
  ) {}

  init(): void { this._status = 'idle' }

  start(): void {
    this._unsubscribe = this.bus.on('chat:message', (payload) => {
      void this.evaluate(payload)
    })
    this._status = 'running'
  }

  stop(): void {
    this._unsubscribe?.()
    this._unsubscribe = null
    this._status = 'stopped'
  }

  dispose(): void { this.stop() }
  status(): ManagerStatus { return this._status }

  private async evaluate(msg: ChatMessagePayload): Promise<void> {
    const persona = withPersonaDefaults(this.getConfig().persona)
    if (!persona.enabled) return
    if (Date.now() - this.lastSpokenAt < persona.cooldownMs) return

    const text = this.selectText(persona, msg)
    if (text === null || text.trim().length === 0) return

    this.lastSpokenAt = Date.now()
    const truncated = text.length > persona.maxChars ? text.slice(0, persona.maxChars) : text

    const audioUrl = await this.tts.synthesize(truncated, {
      rate: persona.voice.rate,
      voice: persona.voice.ttsVoice,
      provider: persona.ttsProvider,
    })
    if (!audioUrl) return

    logger.info(`[persona] speaking (user: ${msg.user}, text: "${truncated}")`)
    this.bus.emit('persona:speak', { user: msg.user, text: truncated, audioUrl, t: Date.now() })
  }

  /** Returns the text to speak, or null if this message doesn't qualify. */
  private selectText(persona: ReturnType<typeof withPersonaDefaults>, msg: ChatMessagePayload): string | null {
    const t = msg.text.trim()
    switch (persona.triggerMode) {
      case 'all':
        return t
      case 'keyword':
        return persona.triggerValue && t.toLowerCase().includes(persona.triggerValue.toLowerCase()) ? t : null
      case 'command': {
        if (!persona.triggerValue) return null
        const prefix = `!${persona.triggerValue.toLowerCase()}`
        const lower = t.toLowerCase()
        if (lower === prefix) return ''
        if (lower.startsWith(`${prefix} `)) return t.slice(prefix.length).trim()
        return null
      }
      case 'chance':
        return Math.random() < (persona.chance ?? 0) ? t : null
    }
  }
}
