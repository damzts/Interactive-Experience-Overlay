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
import type { Manager, ManagerStatus, AppConfig, ChatMessagePayload, PersonaEventLine, PersonaSpeakPayload } from '@ieomlabs/shared'
import { withPersonaDefaults } from '@ieomlabs/shared'
import type { KernelBus, BusFrame } from '../bus.js'
import type { TtsService } from '../../services/TtsService.js'
import type { LlmService, LlmMessage } from '../../services/LlmService.js'
import logger from '../../lib/logger.js'

const CHAT_LOG_CAP = 300
const SUMMARY_WINDOW_CAP = 150
const CONVERSATION_CAP = 24 // 12 streamer↔persona exchanges

function truncate(text: string, maxChars: number): string {
  const t = text.trim()
  return t.length > maxChars ? t.slice(0, maxChars) : t
}

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

  // ── Brain state (RAM-only) ──────────────────────────────────────
  /** Rolling chat memory for summaries and reply context. */
  private chatLog: Array<{ user: string; text: string; t: number }> = []
  private lastSummaryAt = Date.now()
  private summaryTimer: ReturnType<typeof setTimeout> | null = null
  /** Streamer↔persona console history. */
  private conversation: LlmMessage[] = []
  /** Drops chat-triggered/interval LLM work while one request runs. */
  private llmBusy = false

  constructor(
    private getConfig: () => AppConfig,
    private bus: KernelBus,
    private tts: TtsService,
    private llm?: LlmService,
  ) {}

  init(): void { this._status = 'idle' }

  start(): void {
    this._unsubscribe = this.bus.on('chat:message', (payload) => {
      this.chatLog.push({ user: payload.user, text: payload.text, t: Date.now() })
      if (this.chatLog.length > CHAT_LOG_CAP) this.chatLog.splice(0, this.chatLog.length - CHAT_LOG_CAP)
      void this.evaluate(payload)
    })
    this._unsubscribeAny = this.bus.onAny((frame: BusFrame) => {
      // chat:message has its own richer path above.
      if (frame.event === 'chat:message' || frame.event === 'persona:speak') return
      if (frame.event === 'persona:summarize') {
        // Automation's signal:emit action (or anything on the bus) can
        // request a summary without new automation-engine code.
        void this.summarizeNow('manual')
        return
      }
      void this.evaluateEventLines(frame)
    })
    this.armSummaryTimer()
    this._status = 'running'
  }

  onConfigChange(): void {
    this.armSummaryTimer()
  }

  stop(): void {
    this._unsubscribe?.()
    this._unsubscribe = null
    this._unsubscribeAny?.()
    this._unsubscribeAny = null
    if (this.summaryTimer) { clearTimeout(this.summaryTimer); this.summaryTimer = null }
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

    // Brain on: the trigger machinery still picks WHICH messages she hears,
    // but the LLM writes what she says back instead of echoing.
    if (persona.brain.enabled && persona.brain.replyToViewers && this.llm) {
      if (this.llmBusy) return
      this.llmBusy = true
      try {
        const reply = await this.generateViewerReply(persona, msg.user, text)
        if (reply) {
          await this.speak(persona, msg.user, reply, 'reply')
          if (persona.brain.postRepliesToChat) {
            this.bus.emit('twitch:chat:send', { text: reply })
          }
        }
      } finally {
        this.llmBusy = false
      }
      return
    }

    await this.speak(persona, msg.user, text)
  }

  // ── Brain: viewer replies ───────────────────────────────────────

  private async generateViewerReply(
    persona: ReturnType<typeof withPersonaDefaults>,
    user: string,
    text: string,
  ): Promise<string | null> {
    if (!this.llm) return null
    const context = this.chatLog.slice(-15).map((m) => `${m.user}: ${m.text}`).join('\n')
    const reply = await this.llm.complete({
      system: `${persona.brain.personality}\n\nA viewer is talking to you in the stream chat. ` +
        'Reply to them in one or two short spoken sentences. Plain text only — no emoji, no markdown.' +
        (context ? `\n\nRecent chat for context:\n${context}` : ''),
      messages: [{ role: 'user', content: `${user} says: ${text}` }],
      maxTokens: 150,
    }, {
      provider: persona.brain.provider,
      model: persona.brain.model || undefined,
      ollamaUrl: persona.brain.ollamaUrl,
    })
    return reply ? truncate(reply, persona.brain.maxReplyChars) : null
  }

  // ── Brain: chat summaries for the streamer ──────────────────────

  /** Speak a summary of recent chat, addressed to the streamer.
   *  'manual' (admin button / persona:summarize bus event) summarizes the
   *  recent log even if it was already summarized; 'interval' only covers
   *  messages since the last summary and respects summaryMinMessages. */
  async summarizeNow(reason: 'manual' | 'interval'): Promise<string | null> {
    if (!this.llm) return null
    const persona = withPersonaDefaults(this.getConfig().persona)
    if (!persona.brain.enabled) return null

    const window = reason === 'interval'
      ? this.chatLog.filter((m) => m.t > this.lastSummaryAt).slice(-SUMMARY_WINDOW_CAP)
      : this.chatLog.slice(-SUMMARY_WINDOW_CAP)
    const minMessages = reason === 'interval' ? Math.max(1, persona.brain.summaryMinMessages) : 1
    if (window.length < minMessages) return null
    if (this.llmBusy) return null

    this.llmBusy = true
    try {
      const log = window.map((m) => `${m.user}: ${m.text}`).join('\n')
      const text = await this.llm.complete({
        system: `${persona.brain.personality}\n\nSummarize what the stream chat has been talking about ` +
          'for the streamer. Speak directly to the streamer in at most two short sentences. ' +
          'Plain spoken text only — no emoji, no markdown, no lists.',
        messages: [{ role: 'user', content: `Recent chat:\n${log}` }],
        maxTokens: 200,
      }, {
        provider: persona.brain.provider,
        model: persona.brain.model || undefined,
        ollamaUrl: persona.brain.ollamaUrl,
      })
      if (!text) return null

      this.lastSummaryAt = Date.now()
      const spoken = truncate(text, persona.brain.maxReplyChars)
      await this.speak(persona, this.activeProfileName(persona), spoken, 'summary')
      return spoken
    } finally {
      this.llmBusy = false
    }
  }

  private armSummaryTimer(): void {
    if (this.summaryTimer) { clearTimeout(this.summaryTimer); this.summaryTimer = null }
    if (this._status !== 'running' && this._status !== 'idle') return
    const persona = withPersonaDefaults(this.getConfig().persona)
    const minutes = persona.brain.summaryIntervalMin
    if (!persona.enabled || !persona.brain.enabled || !this.llm || minutes <= 0) return
    this.summaryTimer = setTimeout(() => {
      void this.summarizeNow('interval').finally(() => this.armSummaryTimer())
    }, minutes * 60_000)
  }

  // ── Brain: streamer console ─────────────────────────────────────

  /** A console message from the streamer. Replies in character (with recent
   *  chat as context), speaks the reply, and returns it for the admin UI. */
  async converse(text: string): Promise<string | null> {
    if (!this.llm) return null
    const persona = withPersonaDefaults(this.getConfig().persona)
    if (!persona.brain.enabled) return null
    const trimmed = text.trim()
    if (!trimmed) return null

    const context = this.chatLog.slice(-30).map((m) => `${m.user}: ${m.text}`).join('\n')
    const reply = await this.llm.complete({
      system: `${persona.brain.personality}\n\nYou are talking privately with the streamer through their ` +
        'admin console. Be their companion and co-host: answer questions, riff, and reference what chat ' +
        'is saying when relevant. One to three short spoken sentences, plain text only.' +
        (context ? `\n\nRecent stream chat:\n${context}` : ''),
      messages: [...this.conversation, { role: 'user', content: trimmed }],
      maxTokens: 300,
    }, {
      provider: persona.brain.provider,
      model: persona.brain.model || undefined,
      ollamaUrl: persona.brain.ollamaUrl,
    })
    if (!reply) return null

    this.conversation.push({ role: 'user', content: trimmed }, { role: 'assistant', content: reply })
    if (this.conversation.length > CONVERSATION_CAP) {
      this.conversation.splice(0, this.conversation.length - CONVERSATION_CAP)
    }

    await this.speak(persona, this.activeProfileName(persona), truncate(reply, persona.brain.maxReplyChars), 'console')
    return reply
  }

  private activeProfileName(persona: ReturnType<typeof withPersonaDefaults>): string {
    return persona.profiles.find((p) => p.id === persona.activeProfileId)?.name ?? 'persona'
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
    await this.speak(persona, author, text, 'event')
  }

  /** Shared synthesis + emission path for every speech source. Claims the
   *  cooldown up front so overlapping candidates can't double-speak. */
  private async speak(
    persona: ReturnType<typeof withPersonaDefaults>,
    author: string,
    text: string,
    kind: NonNullable<PersonaSpeakPayload['kind']> = 'chat',
  ): Promise<void> {
    this.lastSpokenAt = Date.now()
    const truncated = text.length > persona.maxChars ? text.slice(0, persona.maxChars) : text

    const audioUrl = await this.tts.synthesize(truncated, {
      rate: persona.voice.rate,
      voice: persona.voice.ttsVoice,
      provider: persona.ttsProvider,
    })
    if (!audioUrl) return

    logger.info(`[persona] speaking (${kind}, user: ${author}, text: "${truncated}")`)
    this.bus.emit('persona:speak', { user: author, text: truncated, audioUrl, t: Date.now(), kind })
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
