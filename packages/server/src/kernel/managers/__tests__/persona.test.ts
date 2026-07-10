import { describe, it, expect, vi } from 'vitest'
import { PersonaManager, renderEventTemplate } from '../persona.js'
import { KernelBus } from '../../bus.js'
import type { AppConfig, PersonaConfig } from '@ieomlabs/shared'
import { DEFAULT_PERSONA_CONFIG } from '@ieomlabs/shared'
import type { TtsService } from '../../../services/TtsService.js'

function makeConfig(persona: Partial<PersonaConfig>): AppConfig {
  return { persona: { ...DEFAULT_PERSONA_CONFIG, enabled: true, ...persona } } as unknown as AppConfig
}

function setup(persona: Partial<PersonaConfig>) {
  const bus = new KernelBus()
  const tts = { synthesize: vi.fn(async () => '/assets/tts/x.wav') } as unknown as TtsService & { synthesize: ReturnType<typeof vi.fn> }
  const manager = new PersonaManager(() => makeConfig(persona), bus, tts)
  const spoken: Array<{ user: string; text: string }> = []
  ;(bus.on as (e: string, cb: (p: { user: string; text: string }) => void) => void)('persona:speak', (p) => spoken.push({ user: p.user, text: p.text }))
  manager.init()
  manager.start()
  return { bus, tts, manager, spoken }
}

const emit = (bus: KernelBus, event: string, payload: unknown) =>
  (bus.emit as unknown as (e: string, p: unknown) => void)(event, payload)

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('renderEventTemplate', () => {
  it('resolves payload fields and blanks unknown or object fields', () => {
    expect(renderEventTemplate('welcome {from} with {viewers}!', { from: 'foo', viewers: 42 }))
      .toBe('welcome foo with 42!')
    expect(renderEventTemplate('hi {nope}', {})).toBe('hi')
    expect(renderEventTemplate('x {obj} y', { obj: { nested: 1 } })).toBe('x y')
    expect(renderEventTemplate('plain line', null)).toBe('plain line')
  })
})

describe('PersonaManager event lines', () => {
  it('speaks a rendered template when a matching kernel event fires', async () => {
    const { bus, tts, manager, spoken } = setup({
      eventLines: [{ event: 'twitch:raid', template: 'welcome raiders from {from}!' }],
    })

    emit(bus, 'twitch:raid', { from: 'foo', viewers: 12 })
    await flush()

    expect(tts.synthesize).toHaveBeenCalledWith('welcome raiders from foo!', expect.objectContaining({ rate: 0 }))
    expect(spoken).toEqual([{ user: 'foo', text: 'welcome raiders from foo!' }])
    manager.stop()
  })

  it('shares the cooldown across event lines and chat', async () => {
    const { bus, manager, spoken } = setup({
      cooldownMs: 60_000,
      eventLines: [{ event: 'twitch:raid', template: 'raid!' }],
    })

    emit(bus, 'twitch:raid', { from: 'a' })
    await flush()
    emit(bus, 'twitch:raid', { from: 'b' })
    await flush()

    expect(spoken).toHaveLength(1)
    manager.stop()
  })

  it('respects per-line chance and enabled flags', async () => {
    const { bus, manager, spoken } = setup({
      cooldownMs: 0,
      eventLines: [
        { event: 'scene:changed', template: 'never', chance: 0 },
        { event: 'overlay:connected', template: 'off', enabled: false },
      ],
    })

    emit(bus, 'scene:changed', { from: 'A', to: 'B' })
    emit(bus, 'overlay:connected', { socketId: 'x' })
    await flush()

    expect(spoken).toEqual([])
    manager.stop()
  })

  it('does not evaluate event lines against chat:message or its own persona:speak', async () => {
    const { bus, manager, spoken } = setup({
      enabled: true,
      triggerMode: 'command',
      triggerValue: 'say',
      cooldownMs: 0,
      eventLines: [
        { event: 'chat:message', template: 'echo {text}' },
        { event: 'persona:speak', template: 'loop {text}' },
      ],
    })

    emit(bus, 'chat:message', { user: 'u', text: 'hello', t: Date.now() })
    await flush()

    // Neither the chat path (no !say command) nor the event-line path spoke.
    expect(spoken).toEqual([])
    manager.stop()
  })

  it('stays silent when the persona is disabled', async () => {
    const { bus, manager, spoken } = setup({
      enabled: false,
      eventLines: [{ event: 'twitch:raid', template: 'raid!' }],
    })

    emit(bus, 'twitch:raid', { from: 'a' })
    await flush()

    expect(spoken).toEqual([])
    manager.stop()
  })
})

// ── Brain (LLM) ──────────────────────────────────────────────────────

import type { LlmService } from '../../../services/LlmService.js'

function setupBrain(persona: Partial<PersonaConfig>, llmReply: string | null = 'a witty reply') {
  const bus = new KernelBus()
  const tts = { synthesize: vi.fn(async () => '/assets/tts/x.wav') } as unknown as TtsService
  const llm = { complete: vi.fn(async () => llmReply) } as unknown as LlmService & { complete: ReturnType<typeof vi.fn> }
  const manager = new PersonaManager(() => makeConfig(persona), bus, tts, llm)
  const spoken: Array<{ user: string; text: string; kind?: string }> = []
  ;(bus.on as (e: string, cb: (p: { user: string; text: string; kind?: string }) => void) => void)(
    'persona:speak', (p) => spoken.push({ user: p.user, text: p.text, kind: p.kind }),
  )
  manager.init()
  manager.start()
  return { bus, llm, manager, spoken }
}

const brainOn = (patch?: Partial<PersonaConfig['brain']>): PersonaConfig['brain'] => ({
  ...DEFAULT_PERSONA_CONFIG.brain,
  enabled: true,
  ...patch,
})

describe('PersonaManager brain', () => {
  it('LLM-replies to trigger-selected chat when replyToViewers is on', async () => {
    const { bus, llm, manager, spoken } = setupBrain({
      triggerMode: 'all', cooldownMs: 0,
      brain: brainOn({ replyToViewers: true }),
    })

    emit(bus, 'chat:message', { user: 'viewer', text: 'hello ene!' })
    await flush()

    expect(llm.complete).toHaveBeenCalledOnce()
    expect(spoken).toEqual([{ user: 'viewer', text: 'a witty reply', kind: 'reply' }])
    manager.stop()
  })

  it('does not post replies to Twitch chat when postRepliesToChat is off (default)', async () => {
    const { bus, manager } = setupBrain({
      triggerMode: 'all', cooldownMs: 0,
      brain: brainOn({ replyToViewers: true }),
    })
    const sent: Array<{ text: string }> = []
    ;(bus.on as (e: string, cb: (p: { text: string }) => void) => void)('twitch:chat:send', (p) => sent.push(p))

    emit(bus, 'chat:message', { user: 'viewer', text: 'hello ene!' })
    await flush()

    expect(sent).toEqual([])
    manager.stop()
  })

  it('emits twitch:chat:send with the LLM reply when postRepliesToChat is on', async () => {
    const { bus, manager, spoken } = setupBrain({
      triggerMode: 'all', cooldownMs: 0,
      brain: brainOn({ replyToViewers: true, postRepliesToChat: true }),
    })
    const sent: Array<{ text: string }> = []
    ;(bus.on as (e: string, cb: (p: { text: string }) => void) => void)('twitch:chat:send', (p) => sent.push(p))

    emit(bus, 'chat:message', { user: 'viewer', text: 'hello ene!' })
    await flush()

    expect(sent).toEqual([{ text: 'a witty reply' }])
    expect(spoken).toEqual([{ user: 'viewer', text: 'a witty reply', kind: 'reply' }])
    manager.stop()
  })

  it('echoes chat unchanged when the brain is disabled', async () => {
    const { bus, llm, manager, spoken } = setupBrain({
      triggerMode: 'all', cooldownMs: 0,
      brain: brainOn({ enabled: false, replyToViewers: true }),
    })

    emit(bus, 'chat:message', { user: 'viewer', text: 'hello ene!' })
    await flush()

    expect(llm.complete).not.toHaveBeenCalled()
    expect(spoken).toEqual([{ user: 'viewer', text: 'hello ene!', kind: 'chat' }])
    manager.stop()
  })

  it('converse() replies in character, speaks, and keeps conversation memory', async () => {
    const { llm, manager, spoken } = setupBrain({ brain: brainOn() })

    const first = await manager.converse('how are you?')
    expect(first).toBe('a witty reply')
    expect(spoken).toEqual([expect.objectContaining({ text: 'a witty reply', kind: 'console' })])

    await manager.converse('and now?')
    const secondCall = llm.complete.mock.calls[1][0] as { messages: Array<{ role: string; content: string }> }
    // prior exchange (user+assistant) + the new user message
    expect(secondCall.messages).toHaveLength(3)
    expect(secondCall.messages[0]).toEqual({ role: 'user', content: 'how are you?' })
    expect(secondCall.messages[1]).toEqual({ role: 'assistant', content: 'a witty reply' })
    manager.stop()
  })

  it('summarizeNow("manual") speaks a summary of the chat log', async () => {
    const { bus, llm, manager, spoken } = setupBrain({ enabled: false, brain: brainOn() })

    emit(bus, 'chat:message', { user: 'a', text: 'poggers' })
    emit(bus, 'chat:message', { user: 'b', text: 'that clip was wild' })
    await flush()

    const summary = await manager.summarizeNow('manual')
    expect(summary).toBe('a witty reply')
    expect(llm.complete).toHaveBeenCalledOnce()
    expect(spoken).toEqual([expect.objectContaining({ kind: 'summary' })])
    manager.stop()
  })

  it('interval summaries respect summaryMinMessages', async () => {
    const { bus, llm, manager } = setupBrain({
      enabled: false,
      brain: brainOn({ summaryMinMessages: 5 }),
    })

    emit(bus, 'chat:message', { user: 'a', text: 'only one message' })
    await flush()

    expect(await manager.summarizeNow('interval')).toBeNull()
    expect(llm.complete).not.toHaveBeenCalled()
    manager.stop()
  })

  it('a persona:summarize bus event triggers a manual summary', async () => {
    const { bus, llm, manager, spoken } = setupBrain({ enabled: false, brain: brainOn() })

    emit(bus, 'chat:message', { user: 'a', text: 'hi' })
    emit(bus, 'persona:summarize', {})
    await flush()
    await flush()

    expect(llm.complete).toHaveBeenCalledOnce()
    expect(spoken).toEqual([expect.objectContaining({ kind: 'summary' })])
    manager.stop()
  })
})
