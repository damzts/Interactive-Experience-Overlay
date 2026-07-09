/**
 * TtsService — synthesizes persona text to speech through pluggable
 * providers (see TtsProvider.ts; SAPI is the built-in default).
 *
 * Output wavs are cached by content hash of (provider, voice, rate, text),
 * so repeated lines — greetings, alert phrases, event reactions — cost one
 * synthesis ever. The cache is LRU-pruned by mtime; hits touch the file to
 * stay hot.
 */
import { mkdirSync, unlinkSync, readdirSync, statSync, existsSync, utimesSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createHash } from 'crypto'
import logger from '../lib/logger.js'
import { SapiTtsProvider, type TtsProvider } from './TtsProvider.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
// Resolve monorepo root from packages/server/dist/services/ (compiled output)
const MONO_ROOT = join(__dirname, '../../../..')
const TTS_ROOT = join(MONO_ROOT, 'assets/tts')
const MAX_CACHED_FILES = 200

export interface TtsRequestOptions {
  /** Speech rate, -10..10 (SAPI convention). */
  rate: number
  /** Provider-specific voice name. Omit for the provider's default voice. */
  voice?: string
  /** Provider id. Omit for 'sapi'. Unknown ids fall back to 'sapi'. */
  provider?: string
}

export class TtsService {
  private providers = new Map<string, TtsProvider>()

  constructor(providers?: TtsProvider[]) {
    mkdirSync(TTS_ROOT, { recursive: true })
    for (const p of providers ?? [new SapiTtsProvider(TTS_ROOT)]) {
      this.providers.set(p.id, p)
    }
  }

  /** Add another synthesis backend (e.g. Piper) at boot. */
  registerProvider(provider: TtsProvider): void {
    this.providers.set(provider.id, provider)
  }

  /** Synthesizes text to a wav under assets/tts/ (cache-first), returns its
   *  servable URL, or null on failure. */
  async synthesize(text: string, opts: TtsRequestOptions): Promise<string | null> {
    const provider = this.providers.get(opts.provider ?? 'sapi') ?? this.providers.get('sapi')
    if (!provider) {
      logger.warn('[tts] no synthesis provider registered')
      return null
    }

    const rate = Math.round(opts.rate)
    const key = createHash('sha256')
      .update(`${provider.id}|${opts.voice ?? ''}|${rate}|${text}`)
      .digest('hex')
      .slice(0, 24)
    const wavPath = join(TTS_ROOT, `${key}.wav`)
    const url = `/assets/tts/${key}.wav`

    if (existsSync(wavPath)) {
      // Cache hit — touch so LRU pruning keeps frequently spoken lines.
      try { const now = new Date(); utimesSync(wavPath, now, now) } catch { /* non-fatal */ }
      return url
    }

    try {
      await provider.synthesize(text, { rate, voice: opts.voice }, wavPath)
      this.pruneOldFiles()
      return url
    } catch (err) {
      logger.warn(`[tts] synthesis failed (${provider.id}): ${(err as Error).message}`)
      try { unlinkSync(wavPath) } catch { /* may not exist */ }
      return null
    }
  }

  private pruneOldFiles(): void {
    try {
      const files = readdirSync(TTS_ROOT)
        .filter((f) => f.endsWith('.wav'))
        .map((f) => ({ f, mtime: statSync(join(TTS_ROOT, f)).mtimeMs }))
        .sort((a, b) => b.mtime - a.mtime)
      for (const { f } of files.slice(MAX_CACHED_FILES)) {
        try { unlinkSync(join(TTS_ROOT, f)) } catch { /* best-effort cleanup */ }
      }
    } catch { /* directory listing failure — nothing to prune */ }
  }
}
