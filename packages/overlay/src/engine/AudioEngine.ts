/** Minimal audio engine for v1 — plays WAV/MP3 SFX via Web Audio API.
 *  SFX files live in /assets/sfx/ (served by the server).
 *  Fails gracefully if AudioContext is blocked or files are missing. */

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
      // Sound file missing — silently skip
    }
  }

  play(id: SoundId) {
    if (!this.ctx || !this.masterGain) return
    const buf = this.buffers.get(id)
    if (!buf) return

    // Unlock AudioContext  (required for browsers that auto-suspend it)
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {})
    }

    const src = this.ctx.createBufferSource()
    src.buffer = buf
    src.connect(this.masterGain)
    src.start()
  }

  setMasterVolume(v: number) {
    if (this.masterGain) this.masterGain.gain.value = Math.max(0, Math.min(1, v))
  }
}

export const audioEngine = new AudioEngine()
