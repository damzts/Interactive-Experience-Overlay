/** Minimal audio engine — plays WAV/MP3 SFX via Web Audio API.
 *  SFX files live in /assets/sfx/ (served by the server).
 *  When a file is missing, a synthetic oscillator fallback is played instead.
 *  Fails gracefully if AudioContext is unavailable. */

type SoundId = 'transition' | 'death' | 'victory' | 'revive' | 'glitch' | 'startup'

class AudioEngine {
  private ctx: AudioContext | null = null
  private buffers = new Map<SoundId, AudioBuffer>()
  private masterGain: GainNode | null = null

  init() {
    try {
      this.ctx = new AudioContext()
      this.masterGain = this.ctx.createGain()
      this.masterGain.gain.value = 0.7
      this.masterGain.connect(this.ctx.destination)
      this.preloadAll()
    } catch {
      console.warn('[AudioEngine] Web Audio API unavailable')
    }
  }

  /** Resume suspended AudioContext. Safe to call any time. */
  unlockContext() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {})
    }
  }

  private async preloadAll() {
    const sounds: SoundId[] = ['transition', 'death', 'victory', 'revive', 'glitch', 'startup']
    await Promise.allSettled(sounds.map((id) => this.load(id)))
  }

  private async load(id: SoundId) {
    if (!this.ctx) return
    try {
      const res = await fetch(`/assets/sfx/${id}.wav`)
      if (!res.ok) return
      const buf = await res.arrayBuffer()
      const decoded = await this.ctx.decodeAudioData(buf)
      this.buffers.set(id, decoded)
    } catch {
      // Sound file missing — will use synthetic fallback
    }
  }

  /** Synthesize a sound using oscillators when the asset file is absent. */
  private playSynthetic(id: SoundId) {
    const ctx = this.ctx
    const out = this.masterGain
    if (!ctx || !out) return

    const now = ctx.currentTime

    const osc = (freq: number, type: OscillatorType, start: number, end: number, gainPeak = 0.4) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = type
      o.frequency.setValueAtTime(freq, now + start)
      g.gain.setValueAtTime(0, now + start)
      g.gain.linearRampToValueAtTime(gainPeak, now + start + 0.01)
      g.gain.exponentialRampToValueAtTime(0.001, now + end)
      o.connect(g)
      g.connect(out)
      o.start(now + start)
      o.stop(now + end)
    }

    const sweep = (freqA: number, freqB: number, type: OscillatorType, start: number, end: number, gainPeak = 0.35) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = type
      o.frequency.setValueAtTime(freqA, now + start)
      o.frequency.linearRampToValueAtTime(freqB, now + end)
      g.gain.setValueAtTime(0, now + start)
      g.gain.linearRampToValueAtTime(gainPeak, now + start + 0.02)
      g.gain.exponentialRampToValueAtTime(0.001, now + end)
      o.connect(g)
      g.connect(out)
      o.start(now + start)
      o.stop(now + end)
    }

    switch (id) {
      case 'startup':
        // Rising sweep: boot beep sequence
        sweep(200, 800, 'sawtooth', 0, 0.8, 0.3)
        osc(880, 'square', 0.82, 1.1, 0.25)
        break

      case 'transition':
        // Quick click + short tone
        osc(600, 'square', 0, 0.08, 0.3)
        sweep(400, 200, 'sine', 0.06, 0.3, 0.2)
        break

      case 'death':
        // Descending tone — downer
        sweep(400, 80, 'sawtooth', 0, 0.6, 0.4)
        osc(60, 'sine', 0.3, 0.9, 0.3)
        break

      case 'victory':
        // Rising arpeggio
        osc(523, 'square', 0,    0.12, 0.3)  // C5
        osc(659, 'square', 0.12, 0.24, 0.3)  // E5
        osc(784, 'square', 0.24, 0.36, 0.3)  // G5
        osc(1047, 'square', 0.36, 0.65, 0.35) // C6
        break

      case 'revive':
        // Boot beep sequence
        osc(440, 'square', 0,    0.09, 0.25)
        osc(440, 'square', 0.12, 0.21, 0.25)
        sweep(440, 880, 'square', 0.28, 0.5, 0.3)
        break

      case 'glitch':
        // Noise burst (white noise via buffer)
        try {
          const bufSize = ctx.sampleRate * 0.25
          const noiseBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate)
          const data = noiseBuf.getChannelData(0)
          for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1
          const src = ctx.createBufferSource()
          const g = ctx.createGain()
          g.gain.setValueAtTime(0.35, now)
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
          src.buffer = noiseBuf
          src.connect(g)
          g.connect(out)
          src.start(now)
        } catch {
          sweep(200, 1200, 'sawtooth', 0, 0.2, 0.3)
        }
        break
    }
  }

  play(id: SoundId) {
    if (!this.ctx || !this.masterGain) return

    this.unlockContext()

    const buf = this.buffers.get(id)
    if (buf) {
      const src = this.ctx.createBufferSource()
      src.buffer = buf
      src.connect(this.masterGain)
      src.start()
    } else {
      // No file loaded — play synthetic fallback
      this.playSynthetic(id)
    }
  }

  setMasterVolume(v: number) {
    if (this.masterGain) this.masterGain.gain.value = Math.max(0, Math.min(1, v))
  }
}

export const audioEngine = new AudioEngine()
