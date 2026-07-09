/**
 * TtsProvider — pluggable speech-synthesis backends for TtsService.
 *
 * A provider turns text into a wav file at a caller-chosen path; the
 * service owns caching, pruning, and URL mapping. SAPI (Windows built-in,
 * offline, no keys) is the default. Additional providers (Piper local
 * neural TTS, cloud voices) register alongside it and are selected per
 * call via PersonaConfig.ttsProvider.
 */
import { spawn } from 'child_process'
import { writeFileSync, unlinkSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'

export interface TtsSynthesisOptions {
  /** Speech rate, -10..10 (SAPI convention, 0 = normal). Providers map as needed. */
  rate: number
  /** Provider-specific voice name (e.g. a SAPI installed-voice name). */
  voice?: string
}

export interface TtsProvider {
  readonly id: string
  /** Synthesize `text` into a wav file at `outWavPath`. Throws on failure. */
  synthesize(text: string, opts: TtsSynthesisOptions, outWavPath: string): Promise<void>
}

// ── SAPI (Windows System.Speech) ──────────────────────────────────
//
// Chat text is untrusted input, so it is written to a temp file and passed
// to a fixed .ps1 script via -File + positional args (never interpolated
// into a -Command string) to avoid command/script injection. The
// "robotic / vocaloid" character is deliberately NOT applied here — the
// overlay's AudioEngine applies the ring-mod/pitch filter client-side
// (playPersonaLine), keeping that knob live-tunable without re-synthesis.

const SYNTH_SCRIPT = `param([string]$TextPath, [string]$WavPath, [int]$Rate, [string]$Voice)
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
if ($Voice) { try { $synth.SelectVoice($Voice) } catch {} }
$synth.Rate = $Rate
$synth.SetOutputToWaveFile($WavPath)
$text = Get-Content -LiteralPath $TextPath -Raw -Encoding UTF8
$synth.Speak($text)
$synth.Dispose()
`

export class SapiTtsProvider implements TtsProvider {
  readonly id = 'sapi'
  private readonly scriptPath: string

  constructor(private workDir: string) {
    this.scriptPath = join(workDir, '_synth.ps1')
    // (Re)write the script whenever its content is stale — the file ships
    // with the repo state, not the user's old copy.
    const current = existsSync(this.scriptPath) ? readFileSync(this.scriptPath, 'utf8') : ''
    if (current !== SYNTH_SCRIPT) writeFileSync(this.scriptPath, SYNTH_SCRIPT, 'utf8')
  }

  async synthesize(text: string, opts: TtsSynthesisOptions, outWavPath: string): Promise<void> {
    const textPath = join(this.workDir, `${randomUUID()}.txt`)
    writeFileSync(textPath, text, 'utf8')
    try {
      await new Promise<void>((resolve, reject) => {
        const proc = spawn('powershell.exe', [
          '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
          '-File', this.scriptPath, textPath, outWavPath, String(Math.round(opts.rate)), opts.voice ?? '',
        ])
        let stderr = ''
        proc.stderr?.on('data', (d) => { stderr += d.toString() })
        proc.on('error', reject)
        proc.on('exit', (code) => {
          if (code === 0) resolve()
          else reject(new Error(`powershell exited ${code}: ${stderr.trim()}`))
        })
      })
    } finally {
      try { unlinkSync(textPath) } catch { /* best-effort cleanup */ }
    }
  }
}
