import { useEffect, useRef, useState } from 'react'
import { audioEngine } from '../engine/AudioEngine'
import { computeBandLevels } from '../engine/audioBands'
import type { AudioBandLevels } from '@ieomlabs/shared'

/** Base hook for audio-reactive renderers — samples the configured reactivity
 *  AnalyserNode via RAF and returns a smoothed 0–1 amplitude level. Follows
 *  whatever source is set via audioEngine.setReactiveSource() (internal engine
 *  bus, microphone, or system audio), falling back to 0 when no analyser is
 *  available (Web Audio not yet unlocked, or unsupported browser). */
export function useAudioLevel(smoothing = 0.7): number {
  const [level, setLevel] = useState(0)
  const dataRef = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const smoothedRef = useRef(0)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const analyser = audioEngine.getReactiveAnalyser()
      if (analyser) {
        if (!dataRef.current || dataRef.current.length !== analyser.frequencyBinCount) {
          dataRef.current = new Uint8Array(analyser.frequencyBinCount)
        }
        analyser.getByteTimeDomainData(dataRef.current)
        let sum = 0
        for (let i = 0; i < dataRef.current.length; i++) {
          const v = (dataRef.current[i] - 128) / 128
          sum += v * v
        }
        const rms = Math.sqrt(sum / dataRef.current.length)
        smoothedRef.current = smoothedRef.current * smoothing + rms * (1 - smoothing)
        setLevel(smoothedRef.current)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [smoothing])

  return level
}

export interface AudioBands extends AudioBandLevels {
  /** Overall frequency-domain average (0-1) — a coarse "how loud" value. */
  level: number
}

const ZERO_BANDS: AudioBands = { level: 0, bass: 0, mid: 0, treble: 0 }

/** Like useAudioLevel, but returns smoothed per-band levels so a renderer
 *  can bind to a specific frequency band (bass-driven pulse, treble-driven
 *  shimmer). Same band math as the audio:* kernel events
 *  (engine/audioBands.ts), so on-screen reactions and automation triggers
 *  agree about what the music is doing. */
export function useAudioBands(smoothing = 0.7): AudioBands {
  const [bands, setBands] = useState<AudioBands>(ZERO_BANDS)
  const dataRef = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const smoothedRef = useRef<AudioBands>({ ...ZERO_BANDS })

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const analyser = audioEngine.getReactiveAnalyser()
      if (analyser) {
        if (!dataRef.current || dataRef.current.length !== analyser.frequencyBinCount) {
          dataRef.current = new Uint8Array(analyser.frequencyBinCount)
        }
        analyser.getByteFrequencyData(dataRef.current)
        const next = computeBandLevels(dataRef.current)
        let level = 0
        for (let i = 0; i < dataRef.current.length; i++) level += dataRef.current[i]
        level = level / dataRef.current.length / 255

        const s = smoothedRef.current
        s.level = s.level * smoothing + level * (1 - smoothing)
        s.bass = s.bass * smoothing + next.bass * (1 - smoothing)
        s.mid = s.mid * smoothing + next.mid * (1 - smoothing)
        s.treble = s.treble * smoothing + next.treble * (1 - smoothing)
        setBands({ ...s })
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [smoothing])

  return bands
}
