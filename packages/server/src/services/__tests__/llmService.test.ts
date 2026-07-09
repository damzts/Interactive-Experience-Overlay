import { describe, it, expect, vi, afterEach } from 'vitest'
import { LlmService, OllamaLlmProvider, AnthropicLlmProvider, type LlmProvider } from '../LlmService.js'

const REQ = { system: 'be brief', messages: [{ role: 'user' as const, content: 'hi' }], maxTokens: 50 }

function fakeProvider(id: string, result: string): LlmProvider {
  return { id, complete: vi.fn(async () => result) }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('LlmService', () => {
  it('routes to the requested provider and defaults to anthropic', async () => {
    const anthropic = fakeProvider('anthropic', 'from anthropic')
    const ollama = fakeProvider('ollama', 'from ollama')
    const svc = new LlmService([anthropic, ollama])

    expect(await svc.complete(REQ, { provider: 'ollama' })).toBe('from ollama')
    expect(await svc.complete(REQ, {})).toBe('from anthropic')
  })

  it('returns null for unknown providers and provider failures', async () => {
    const broken: LlmProvider = { id: 'anthropic', complete: vi.fn(async () => { throw new Error('boom') }) }
    const svc = new LlmService([broken])

    expect(await svc.complete(REQ, { provider: 'nope' })).toBeNull()
    expect(await svc.complete(REQ, {})).toBeNull()
  })

  it('anthropic provider fails cleanly without ANTHROPIC_API_KEY', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    const svc = new LlmService([new AnthropicLlmProvider()])
    expect(await svc.complete(REQ, {})).toBeNull()
  })

  it('ollama provider posts the expected chat request shape', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ message: { content: 'local reply' } }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const svc = new LlmService([new OllamaLlmProvider()])
    const result = await svc.complete(REQ, { provider: 'ollama', model: 'qwen2.5', ollamaUrl: 'http://127.0.0.1:11434/' })

    expect(result).toBe('local reply')
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, { body: string }]
    expect(url).toBe('http://127.0.0.1:11434/api/chat')
    const body = JSON.parse(init.body)
    expect(body.model).toBe('qwen2.5')
    expect(body.stream).toBe(false)
    expect(body.messages[0]).toEqual({ role: 'system', content: 'be brief' })
    expect(body.messages[1]).toEqual({ role: 'user', content: 'hi' })
  })
})
