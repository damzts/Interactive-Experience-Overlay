/**
 * TtsService — synthesizes chat text to speech for the Persona feature.
 *
 * Windows-only: shells out to PowerShell's System.Speech SAPI synthesizer
 * (built into Windows, no API key / network dependency). The "robotic /
 * vocaloid" character is deliberately NOT applied here — this produces a
 * plain flat voice; the overlay's AudioEngine applies the ring-mod/pitch
 * filter client-side (see playPersonaLine), which keeps that knob live-
 * tunable without re-synthesizing audio.
 *
 * Chat text is untrusted input, so it is written to a temp file and passed
 * to a fixed .ps1 script via -File + positional args (never interpolated
 * into a -Command string) to avoid command/script injection.
 */
import { spawn } from 'child_process'
import { mkdirSync, writeFileSync, unlinkSync, readdirSync, statSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { randomUUID } from 'crypto'
import logger from '../lib/logger.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
// Resolve monorepo root from packages/server/dist/services/ (compiled output)
const MONO_ROOT = join(__dirname, '../../../..')
const TTS_ROOT = join(MONO_ROOT, 'assets/tts')
const SYNTH_SCRIPT_PATH = join(TTS_ROOT, '_synth.ps1')
const MAX_CACHED_FILES = 50

const SYNTH_SCRIPT = `param([string]$TextPath, [string]$WavPath, [int]$Rate)
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.Rate = $Rate
$synth.SetOutputToWaveFile($WavPath)
$text = Get-Content -LiteralPath $TextPath -Raw -Encoding UTF8
$synth.Speak($text)
$synth.Dispose()
`

export class TtsService {
  constructor() {
    mkdirSync(TTS_ROOT, { recursive: true })
    if (!existsSync(SYNTH_SCRIPT_PATH)) {
      writeFileSync(SYNTH_SCRIPT_PATH, SYNTH_SCRIPT, 'utf8')
    }
  }

  /** Synthesizes text to a wav file under assets/tts/, returns its servable URL, or null on failure. */
  async synthesize(text: string, rate: number): Promise<string | null> {
    const id = randomUUID()
    const textPath = join(TTS_ROOT, `${id}.txt`)
    const wavPath = join(TTS_ROOT, `${id}.wav`)
    writeFileSync(textPath, text, 'utf8')

    try {
      await new Promise<void>((resolve, reject) => {
        const proc = spawn('powershell.exe', [
          '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
          '-File', SYNTH_SCRIPT_PATH, textPath, wavPath, String(Math.round(rate)),
        ])
        let stderr = ''
        proc.stderr?.on('data', (d) => { stderr += d.toString() })
        proc.on('error', reject)
        proc.on('exit', (code) => {
          if (code === 0) resolve()
          else reject(new Error(`powershell exited ${code}: ${stderr.trim()}`))
        })
      })
      this.pruneOldFiles()
      return `/assets/tts/${id}.wav`
    } catch (err) {
      logger.warn(`[tts] synthesis failed: ${(err as Error).message}`)
      return null
    } finally {
      try { unlinkSync(textPath) } catch { /* best-effort cleanup */ }
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
