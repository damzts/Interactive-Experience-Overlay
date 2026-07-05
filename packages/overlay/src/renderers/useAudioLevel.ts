import { useEffect, useRef, useState } from 'react'
import { audioEngine } from '../engine/AudioEngine'

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
