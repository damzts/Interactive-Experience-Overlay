import { useEffect, useRef, useState } from 'react'
import { socket } from '../socket/client'
import type { AudioLevelPayload } from '@ieomlabs/shared'

const DECAY_PER_MS = 0.0025
const STALE_AFTER_MS = 600

/**
 * Subscribes to the overlay's throttled audio:level relay (~10Hz) for the
 * Audio panel's VU meter. Decays smoothly toward 0 between samples (rather
 * than holding the last value or jumping) and resets to 0 if no sample has
 * arrived recently — e.g. the overlay isn't connected, or no reactivity
 * source is configured, so there's no analyser to sample.
 */
export function useAudioLevelMeter(): number {
  const [level, setLevel] = useState(0)
  const targetRef = useRef(0)
  const lastSampleAtRef = useRef(0)

  useEffect(() => {
    const handleLevel = (payload: AudioLevelPayload) => {
      targetRef.current = Math.max(0, Math.min(1, payload.level))
      lastSampleAtRef.current = performance.now()
    }
    socket.on('audio:level', handleLevel)

    let raf = 0
    let lastTick = performance.now()
    const tick = () => {
      const now = performance.now()
      const dt = now - lastTick
      lastTick = now

      const stale = now - lastSampleAtRef.current > STALE_AFTER_MS
      const target = stale ? 0 : targetRef.current

      setLevel((current) => {
        if (current === target) return current
        const step = DECAY_PER_MS * dt * 4
        if (target > current) return Math.min(target, current + step)
        return Math.max(target, current - step)
      })

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      socket.off('audio:level', handleLevel)
      cancelAnimationFrame(raf)
    }
  }, [])

  return level
}
