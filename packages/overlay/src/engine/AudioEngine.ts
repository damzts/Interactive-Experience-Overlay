/** Minimal audio engine — plays WAV/MP3 SFX via Web Audio API.
 *  SFX files live in /assets/sfx/ (served by the server).
 *  When a file is missing, a synthetic oscillator fallback is played instead.
 *  Fails gracefully if AudioContext is unavailable.
 *
 *  Audio graph: masterGain → analyser → destination
 *  Music and ambient tracks are routed through masterGain via MediaElementAudioSourceNode,
 *  so master volume and the analyser apply to all audio uniformly. */

type SoundId = 'transition' | 'death' | 'victory' | 'revive' | 'glitch' | 'startup'

const URL_CACHE_MAX = 20

class AudioEngine {
  private ctx: AudioContext | null = null
  private buffers = new Map<SoundId, AudioBuffer>()
  private masterGain: GainNode | null = null
  private analyser: AnalyserNode | null = null

  // Music track (switches per scene)
  private _musicEl: HTMLAudioElement | null = null
  private _musicSource: MediaElementAudioSourceNode | null = null
  private _musicGain: GainNode | null = null
  private _musicVolume: number = 0.5

  // Ambient track (persists across scene musicTrack changes)
  private _ambientEl: HTMLAudioElement | null = null
  private _ambientSource: MediaElementAudioSourceNode | null = null
  private _ambientGain: GainNode | null = null
  private _ambientVolume: number = 0.4

  // LRU cache for playUrl()
  private _urlCache = new Map<string, AudioBuffer>()

  init() {
    try {
      this.ctx = new AudioContext()
      this.masterGain = this.ctx.createGain()
      this.masterGain.gain.value = 0.7

      // Insert analyser between masterGain and destination
      this.analyser = this.ctx.createAnalyser()
      this.analyser.fftSize = 2048
      this.masterGain.connect(this.analyser)
      this.analyser.connect(this.ctx.destination)

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

  /** Access the AnalyserNode for real-time frequency/energy data. */
  getAnalyser(): AnalyserNode | null {
    return this.analyser
  }

  private async preloadAll() {
    const sounds: SoundId[] = ['transition', 'death', 'victory', 'revive', 'glitch', 'startup']
    await Promise.allSettled(sounds.map((id) => this.load(id)))
  }

  private async load(id: SoundId) {
    if (!this.ctx) return
    try {
      const res = await fetch(`/assets/audio/sfx/${id}.wav`)
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

  /** Play a one-shot sound from any URL. Caches decoded buffers (LRU, max 20). */
  async playUrl(url: string): Promise<void> {
    if (!this.ctx || !this.masterGain) return
    this.unlockContext()
    try {
      let buf = this._urlCache.get(url)
      if (!buf) {
        const res = await fetch(url)
        if (!res.ok) return
        buf = await this.ctx.decodeAudioData(await res.arrayBuffer())
        // LRU eviction: drop oldest entry when at capacity
        if (this._urlCache.size >= URL_CACHE_MAX) {
          const oldest = this._urlCache.keys().next().value
          if (oldest !== undefined) this._urlCache.delete(oldest)
        }
        this._urlCache.set(url, buf)
      } else {
        // Move to end (most recently used)
        this._urlCache.delete(url)
        this._urlCache.set(url, buf)
      }
      const src = this.ctx.createBufferSource()
      src.buffer = buf
      src.connect(this.masterGain)
      src.start()
    } catch {
      // Ignore — bad URL or decode failure
    }
  }

  setMasterVolume(v: number) {
    if (this.masterGain) this.masterGain.gain.value = Math.max(0, Math.min(1, v))
  }

  // ── Music track ──────────────────────────────────────────────────

  /** Play a looping background music track, crossfading from the previous track.
   *  Routes through the Web Audio graph (masterGain + analyser) unlike the old HTMLAudioElement path.
   *  Note: crossOrigin='anonymous' is set on the element; same-origin assets work as-is.
   *  Pass null to fade out and stop. */
  playMusic(url: string | null, crossfadeMs = 1500) {
    if (!this.ctx || !this.masterGain) return
    this.unlockContext()

    const prevGain = this._musicGain
    const prevEl = this._musicEl

    if (prevGain && prevEl) {
      // Fade out previous track then disconnect
      const endTime = this.ctx.currentTime + crossfadeMs / 1000
      prevGain.gain.setValueAtTime(prevGain.gain.value, this.ctx.currentTime)
      prevGain.gain.linearRampToValueAtTime(0, endTime)
      setTimeout(() => {
        prevEl.pause()
        prevEl.src = ''
        prevGain.disconnect()
      }, crossfadeMs + 50)
    }

    if (!url) {
      this._musicEl = null
      this._musicSource = null
      this._musicGain = null
      return
    }

    const el = new Audio()
    el.crossOrigin = 'anonymous'
    el.loop = true
    el.src = url

    const gainNode = this.ctx.createGain()
    gainNode.gain.value = 0
    gainNode.connect(this.masterGain)

    // createMediaElementSource must be called once per element
    const source = this.ctx.createMediaElementSource(el)
    source.connect(gainNode)

    el.play().catch(() => {})

    // Fade in
    const endTime = this.ctx.currentTime + crossfadeMs / 1000
    gainNode.gain.setValueAtTime(0, this.ctx.currentTime)
    gainNode.gain.linearRampToValueAtTime(this._musicVolume, endTime)

    this._musicEl = el
    this._musicSource = source
    this._musicGain = gainNode
  }

  setMusicVolume(v: number) {
    this._musicVolume = Math.max(0, Math.min(1, v))
    if (this._musicGain) this._musicGain.gain.value = this._musicVolume
  }

  // ── Ambient track ────────────────────────────────────────────────

  /** Play an independent looping ambient layer (crowd noise, room tone, rain, etc.).
   *  Persists across scene musicTrack changes — only changes when ambientTrack changes.
   *  Pass null to fade out and stop. */
  playAmbient(url: string | null, crossfadeMs = 2000) {
    if (!this.ctx || !this.masterGain) return
    this.unlockContext()

    const prevGain = this._ambientGain
    const prevEl = this._ambientEl

    if (prevGain && prevEl) {
      const endTime = this.ctx.currentTime + crossfadeMs / 1000
      prevGain.gain.setValueAtTime(prevGain.gain.value, this.ctx.currentTime)
      prevGain.gain.linearRampToValueAtTime(0, endTime)
      setTimeout(() => {
        prevEl.pause()
        prevEl.src = ''
        prevGain.disconnect()
      }, crossfadeMs + 50)
    }

    if (!url) {
      this._ambientEl = null
      this._ambientSource = null
      this._ambientGain = null
      return
    }

    const el = new Audio()
    el.crossOrigin = 'anonymous'
    el.loop = true
    el.src = url

    const gainNode = this.ctx.createGain()
    gainNode.gain.value = 0
    gainNode.connect(this.masterGain)

    const source = this.ctx.createMediaElementSource(el)
    source.connect(gainNode)

    el.play().catch(() => {})

    const endTime = this.ctx.currentTime + crossfadeMs / 1000
    gainNode.gain.setValueAtTime(0, this.ctx.currentTime)
    gainNode.gain.linearRampToValueAtTime(this._ambientVolume, endTime)

    this._ambientEl = el
    this._ambientSource = source
    this._ambientGain = gainNode
  }

  setAmbientVolume(v: number) {
    this._ambientVolume = Math.max(0, Math.min(1, v))
    if (this._ambientGain) this._ambientGain.gain.value = this._ambientVolume
  }
}

export const audioEngine = new AudioEngine()
