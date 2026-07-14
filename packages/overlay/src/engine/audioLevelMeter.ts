import { audioEngine } from './AudioEngine'
import { socket } from '../socket/client'
import { bandAverage, computeBandLevels } from './audioBands'

/**
 * Always-on, lightweight level meter — decoupled from the reactivity
 * enabled/disabled toggle in the Admin Audio panel. Its only job is to let
 * an operator SEE whether audio is actually reaching whatever analyser
 * audioEngine.getReactiveAnalyser() currently points at (internal engine bus
 * + any registered screen-share widget audio, or the microphone tap) — the
 * VU meter in the Audio panel reads this. Useful for debugging capture
 * itself (e.g. "is my screen-share widget's audio actually wired in?")
 * without first having to enable reactivity/automation.
 *
 * Throttled to ~10Hz over the socket — plenty for a meter, cheap enough to
 * run continuously. Emits nothing when no analyser is available (Web Audio
 * not yet unlocked, or no source configured) so idle overlays stay silent.
 */

const EMIT_INTERVAL_MS = 100

let running = false
let raf = 0
let freqData: Uint8Array<ArrayBuffer> | null = null
let lastEmitAt = 0

export function startAudioLevelMeter(): () => void {
  if (running) return () => {}
  running = true

  const tick = () => {
    if (!running) return
    const analyser = audioEngine.getReactiveAnalyser()
    if (analyser) {
      const now = performance.now()
      if (now - lastEmitAt >= EMIT_INTERVAL_MS) {
        lastEmitAt = now
        if (!freqData || freqData.length !== analyser.frequencyBinCount) {
          freqData = new Uint8Array(analyser.frequencyBinCount)
        }
        analyser.getByteFrequencyData(freqData)
        const bands = computeBandLevels(freqData)
        const level = bandAverage(freqData, 0, freqData.length)
        socket.emit('audio:level', { level, bands })
      }
    }
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)

  return () => {
    running = false
    cancelAnimationFrame(raf)
  }
}
