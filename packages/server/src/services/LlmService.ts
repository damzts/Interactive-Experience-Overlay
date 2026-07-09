/**
 * LlmService — pluggable chat-completion backends for the persona's brain
 * (chat summaries, streamer console, viewer replies).
 *
 * Mirrors TtsService's provider pattern: built-ins are Anthropic (cloud,
 * ANTHROPIC_API_KEY env var — the key stays out of the config DB because
 * config is broadcast to every client) and Ollama (local, no key). Both
 * use the global fetch like the Twitch Helix calls — no new dependencies.
 * Failures resolve to null so the persona silently skips a line instead
 * of crashing a bus handler.
 */
import logger from '../lib/logger.js'

export interface LlmMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface LlmCompletionRequest {
  system: string
  messages: LlmMessage[]
  maxTokens: number
}

export interface LlmProviderOptions {
  /** Provider-specific model name. Omit for the provider's default. */
  model?: string
  /** Ollama base URL (ignored by other providers). */
  ollamaUrl?: string
}

export interface LlmProvider {
  readonly id: string
  /** Returns the completion text. Throws on failure. */
  complete(req: LlmCompletionRequest, opts: LlmProviderOptions, signal: AbortSignal): Promise<string>
}

const REQUEST_TIMEOUT_MS = 30_000

// ── Anthropic (Haiku by default) ──────────────────────────────────

export class AnthropicLlmProvider implements LlmProvider {
  readonly id = 'anthropic'

  async complete(req: LlmCompletionRequest, opts: LlmProviderOptions, signal: AbortSignal): Promise<string> {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set in the server environment')

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: opts.model || 'claude-haiku-4-5',
        max_tokens: req.maxTokens,
        system: req.system,
        messages: req.messages,
      }),
    })
    if (!res.ok) throw new Error(`anthropic responded ${res.status}: ${(await res.text()).slice(0, 200)}`)

    const json = await res.json() as { content?: Array<{ type: string; text?: string }> }
    const text = json.content?.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('') ?? ''
    if (!text.trim()) throw new Error('anthropic returned an empty completion')
    return text.trim()
  }
}

// ── Ollama (local) ────────────────────────────────────────────────

export class OllamaLlmProvider implements LlmProvider {
  readonly id = 'ollama'

  async complete(req: LlmCompletionRequest, opts: LlmProviderOptions, signal: AbortSignal): Promise<string> {
    const base = (opts.ollamaUrl || 'http://localhost:11434').replace(/\/$/, '')
    const res = await fetch(`${base}/api/chat`, {
      method: 'POST',
      signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: opts.model || 'llama3.2',
        stream: false,
        options: { num_predict: req.maxTokens },
        messages: [{ role: 'system', content: req.system }, ...req.messages],
      }),
    })
    if (!res.ok) throw new Error(`ollama responded ${res.status}: ${(await res.text()).slice(0, 200)}`)

    const json = await res.json() as { message?: { content?: string } }
    const text = json.message?.content ?? ''
    if (!text.trim()) throw new Error('ollama returned an empty completion')
    return text.trim()
  }
}

// ── Service ───────────────────────────────────────────────────────

export class LlmService {
  private providers = new Map<string, LlmProvider>()

  constructor(providers?: LlmProvider[]) {
    for (const p of providers ?? [new AnthropicLlmProvider(), new OllamaLlmProvider()]) {
      this.providers.set(p.id, p)
    }
  }

  registerProvider(provider: LlmProvider): void {
    this.providers.set(provider.id, provider)
  }

  /** Completion text, or null on any failure (logged, never thrown). */
  async complete(
    req: LlmCompletionRequest,
    opts: LlmProviderOptions & { provider?: string },
  ): Promise<string | null> {
    const provider = this.providers.get(opts.provider ?? 'anthropic')
    if (!provider) {
      logger.warn(`[llm] unknown provider '${opts.provider}'`)
      return null
    }

    const abort = new AbortController()
    const timer = setTimeout(() => abort.abort(), REQUEST_TIMEOUT_MS)
    try {
      return await provider.complete(req, opts, abort.signal)
    } catch (err) {
      logger.warn(`[llm] completion failed (${provider.id}): ${(err as Error).message}`)
      return null
    } finally {
      clearTimeout(timer)
    }
  }
}
