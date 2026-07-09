/**
 * PersonaManager — chat-to-voice companion (see @ieomlabs/shared PersonaConfig doc comment).
 *
 * Two speech sources, one voice and one cooldown:
 *  - chat: subscribes to the 'chat:message' bus event, picks a candidate
 *    message per PersonaConfig.triggerMode
 *  - events: evaluates PersonaConfig.eventLines against every bus frame
 *    (raids, scene changes, silence, ...) and speaks the line's template
 *    with {field} placeholders resolved from the event payload
 *
 * Either way the text is synthesized via TtsService and emitted as the
 * public 'persona:speak' kernel signal so the overlay can play it and
 * show a caption. Mirrors ChatReactionManager's shape: reads config fresh
 * on every message rather than caching it, and stays decoupled from
 * HandlerContext.
 */
import type { Manager, ManagerStatus, AppConfig, ChatMessagePayload, PersonaEventLine } from '@ieomlabs/shared'
import { withPersonaDefaults } from '@ieomlabs/shared'
import type { KernelBus, BusFrame } from '../bus.js'
import type { TtsService } from '../../services/TtsService.js'
import logger from '../../lib/logger.js'

/** Resolve {field} placeholders from a payload object; unknown fields become ''. */
export function renderEventTemplate(template: string, payload: unknown): string {
  const p = (typeof payload === 'object' && payload !== null ? payload : {}) as Record<string, unknown>
  return template.replace(/\{([a-zA-Z0-9_.:-]+)\}/g, (_m, key: string) => {
    const value = p[key]
    if (value == null) return ''
    if (typeof value === 'object') return ''
    return String(value)
  }).replace(/\s{2,}/g, ' ').trim()
}

export class PersonaManager implements Manager {
  readonly name = 'PersonaManager'
  readonly bootPriority = 40

  private _status: ManagerStatus = 'idle'
  private _unsubscribe: (() => void) | null = null
  private _unsubscribeAny: (() => void) | null = null
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
    this._unsubscribeAny = this.bus.onAny((frame: BusFrame) => {
      // chat:message has its own richer path above.
      if (frame.event === 'chat:message' || frame.event === 'persona:speak') return
      void this.evaluateEventLines(frame)
    })
    this._status = 'running'
  }

  stop(): void {
    this._unsubscribe?.()
    this._unsubscribe = null
    this._unsubscribeAny?.()
    this._unsubscribeAny = null
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

    await this.speak(persona, msg.user, text)
  }

  private async evaluateEventLines(frame: BusFrame): Promise<void> {
    const persona = withPersonaDefaults(this.getConfig().persona)
    if (!persona.enabled || persona.eventLines.length === 0) return
    if (Date.now() - this.lastSpokenAt < persona.cooldownMs) return

    const line = persona.eventLines.find((l: PersonaEventLine) =>
      (l.enabled ?? true) && l.event === frame.event && l.template.trim().length > 0,
    )
    if (!line) return
    if (line.chance != null && Math.random() >= line.chance) return

    const text = renderEventTemplate(line.template, frame.payload)
    if (!text) return

    const p = (typeof frame.payload === 'object' && frame.payload !== null ? frame.payload : {}) as Record<string, unknown>
    const author = typeof p['user'] === 'string' ? p['user'] as string
      : typeof p['from'] === 'string' ? p['from'] as string
      : 'persona'
    await this.speak(persona, author, text)
  }

  /** Shared synthesis + emission path for both speech sources. Claims the
   *  cooldown up front so overlapping candidates can't double-speak. */
  private async speak(persona: ReturnType<typeof withPersonaDefaults>, author: string, text: string): Promise<void> {
    this.lastSpokenAt = Date.now()
    const truncated = text.length > persona.maxChars ? text.slice(0, persona.maxChars) : text

    const audioUrl = await this.tts.synthesize(truncated, {
      rate: persona.voice.rate,
      voice: persona.voice.ttsVoice,
      provider: persona.ttsProvider,
    })
    if (!audioUrl) return

    logger.info(`[persona] speaking (user: ${author}, text: "${truncated}")`)
    this.bus.emit('persona:speak', { user: author, text: truncated, audioUrl, t: Date.now() })
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
