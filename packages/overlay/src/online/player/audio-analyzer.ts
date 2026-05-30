/**
 * Client-side audio level analyzer using Web Audio API.
 * Computes RMS audio levels from the microphone stream and reports them
 * at a configurable interval via callbacks.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */

/**
 * Pure function: computes the RMS (root mean square) level from time-domain data.
 *
 * The AnalyserNode.getByteTimeDomainData() returns values in [0, 255] where 128
 * represents silence. We normalize each sample to [-1, 1], compute the RMS,
 * and clamp the result to [0, 1].
 *
 * Formula: sqrt(mean(((sample - 128) / 128)^2)) clamped to [0, 1]
 */
export function computeRmsLevel(frequencyData: Uint8Array): number {
  if (frequencyData.length === 0) {
    return 0
  }

  let sumOfSquares = 0
  for (let i = 0; i < frequencyData.length; i++) {
    const normalized = (frequencyData[i] - 128) / 128
    sumOfSquares += normalized * normalized
  }

  const mean = sumOfSquares / frequencyData.length
  const rms = Math.sqrt(mean)

  // Clamp to [0, 1]
  return Math.min(1, Math.max(0, rms))
}

export type LevelCallback = (level: number) => void

/**
 * AudioLevelAnalyzer wraps the Web Audio API to periodically compute and
 * report microphone audio levels. It creates an AudioContext and AnalyserNode
 * from a provided MediaStream, reads time-domain data at a configurable
 * interval, and invokes registered callbacks with the computed RMS level.
 *
 * When the microphone is muted or the AudioContext is suspended, it reports
 * a level of 0. When the AnalyserNode is unavailable, it sets a warning state.
 */
export class AudioLevelAnalyzer {
  private audioContext: AudioContext | null = null
  private analyserNode: AnalyserNode | null = null
  private sourceNode: MediaStreamAudioSourceNode | null = null
  private intervalId: ReturnType<typeof setInterval> | null = null
  private timeDomainData: Uint8Array<ArrayBuffer> | null = null
  private currentLevel = 0
  private callbacks: LevelCallback[] = []
  private _warningActive = false
  private _muted = false

  /**
   * Whether the analyzer is in a warning state (AnalyserNode unavailable).
   */
  get warningActive(): boolean {
    return this._warningActive
  }

  /**
   * Set the muted state. When muted, reports level 0.
   */
  set muted(value: boolean) {
    this._muted = value
  }

  get muted(): boolean {
    return this._muted
  }

  /**
   * Start analyzing audio from a MediaStream at the given interval.
   * @param stream - The MediaStream containing the audio track to analyze
   * @param intervalMs - Reporting interval in milliseconds (default 100ms)
   */
  start(stream: MediaStream, intervalMs = 100): void {
    this.stop()
    this._warningActive = false

    try {
      this.audioContext = new AudioContext()
      this.analyserNode = this.audioContext.createAnalyser()
      this.analyserNode.fftSize = 2048
      this.sourceNode = this.audioContext.createMediaStreamSource(stream)
      this.sourceNode.connect(this.analyserNode)
      this.timeDomainData = new Uint8Array(this.analyserNode.fftSize)
    } catch {
      // AnalyserNode unavailable — enter warning state
      this._warningActive = true
      this.analyserNode = null
      this.timeDomainData = null
    }

    this.intervalId = setInterval(() => {
      this.computeAndReport()
    }, intervalMs)
  }

  /**
   * Stop analysis and release resources.
   */
  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect()
      this.sourceNode = null
    }

    if (this.audioContext) {
      this.audioContext.close().catch(() => {
        // Ignore close errors
      })
      this.audioContext = null
    }

    this.analyserNode = null
    this.timeDomainData = null
    this.currentLevel = 0
    this._warningActive = false
  }

  /**
   * Get the most recently computed audio level (0-1 linear, RMS normalized).
   */
  getCurrentLevel(): number {
    return this.currentLevel
  }

  /**
   * Register a callback for periodic level reports.
   * @param callback - Function called with the computed level (0-1)
   */
  onLevel(callback: LevelCallback): void {
    this.callbacks.push(callback)
  }

  /**
   * Remove a previously registered callback.
   */
  offLevel(callback: LevelCallback): void {
    this.callbacks = this.callbacks.filter((cb) => cb !== callback)
  }

  /**
   * Internal: compute the current level and notify callbacks.
   */
  private computeAndReport(): void {
    const level = this.computeLevel()
    this.currentLevel = level
    for (const cb of this.callbacks) {
      cb(level)
    }
  }

  /**
   * Internal: compute the current audio level.
   * Returns 0 when muted, audio context is suspended, or analyser is unavailable.
   */
  private computeLevel(): number {
    // Muted → level 0
    if (this._muted) {
      return 0
    }

    // AnalyserNode unavailable (warning state) → level 0
    if (!this.analyserNode || !this.timeDomainData) {
      return 0
    }

    // Audio context suspended → level 0
    if (this.audioContext && this.audioContext.state === 'suspended') {
      return 0
    }

    // Read time-domain data and compute RMS
    this.analyserNode.getByteTimeDomainData(this.timeDomainData)
    return computeRmsLevel(this.timeDomainData)
  }
}
