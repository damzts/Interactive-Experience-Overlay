import { audioEngine } from './AudioEngine'
import { socket } from '../socket/client'
import { bandAverage, computeBandLevels } from './audioBands'

/**
 * Generalizes the beat/energy logic that used to live only inline in
 * MediaVizRenderer (bandAverage + adaptive bass threshold) into a reusable,
 * always-on monitor. Reads whatever audioEngine.getReactiveAnalyser() is
 * currently pointed at (internal engine bus, mic, or system audio) and
 * reports discrete events to the kernel over dedicated socket commands —
 * promoting them to first-class kernel signals (audio:beat, audio:energy:high/low,
 * audio:silence) that any Automation rule can trigger on.
 *
 * Debounced/refractory so a sustained loud passage doesn't spam the bus:
 * beats are rate-limited, energy-high/low only fire on a state change with
 * hysteresis, and silence only fires after a few seconds below the noise floor.
 */

const BEAT_REFRACTORY_MS = 150
const ENERGY_HIGH_THRESHOLD = 0.35
const ENERGY_LOW_THRESHOLD = 0.15
const ENERGY_HYSTERESIS_MS = 1000
const SILENCE_THRESHOLD = 0.03
const SILENCE_HOLD_MS = 3000

let running = false
let raf = 0
let freqData: Uint8Array<ArrayBuffer> | null = null

export function startAudioReactivityMonitor(): () => void {
  if (running) return () => {}
  running = true

  let bassAvg = 0.1
  let lastBeatAt = 0
  let energyState: 'idle' | 'high' | 'low' = 'idle'
  let energyStateSince = 0
  let silentSince: number | null = null

  const tick = () => {
    if (!running) return
    const analyser = audioEngine.getReactiveAnalyser()
    if (analyser) {
      if (!freqData || freqData.length !== analyser.frequencyBinCount) {
        freqData = new Uint8Array(analyser.frequencyBinCount)
      }
      analyser.getByteFrequencyData(freqData)

      const bands = computeBandLevels(freqData)
      const bass = bands.bass
      const energy = bandAverage(freqData, 0, freqData.length)
      const now = performance.now()

      bassAvg += (bass - bassAvg) * 0.04

      if (bass > bassAvg * 1.4 && bass > 0.28 && now - lastBeatAt > BEAT_REFRACTORY_MS) {
        lastBeatAt = now
        socket.emit('audio:beat', { energy, bass, bands })
      }

      if (energy > ENERGY_HIGH_THRESHOLD) {
        if (energyState !== 'high' && now - energyStateSince > ENERGY_HYSTERESIS_MS) {
          energyState = 'high'
          energyStateSince = now
          socket.emit('audio:energy:high', { energy, bands })
        }
      } else if (energy < ENERGY_LOW_THRESHOLD) {
        if (energyState !== 'low' && now - energyStateSince > ENERGY_HYSTERESIS_MS) {
          energyState = 'low'
          energyStateSince = now
          socket.emit('audio:energy:low', { energy, bands })
        }
      }

      if (energy < SILENCE_THRESHOLD) {
        if (silentSince === null) silentSince = now
        else if (now - silentSince > SILENCE_HOLD_MS) {
          socket.emit('audio:silence')
          silentSince = now // re-arm hold window so silence doesn't spam either
        }
      } else {
        silentSince = null
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
