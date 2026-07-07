import { useEffect, useRef } from 'react'
import type { RendererProps } from '../registry'
import { useAudioLevel } from '../useAudioLevel'

/** TAPE-WEAR — Signal Ghost. A dim tracking-line sweep drifts down the frame
 *  at random intervals over a warm CRT-glow gradient; louder audio pushes the
 *  tracking error briefly worse, like the tape straining. */
export function TapeWearRenderer({ config, bounds }: RendererProps) {
  const glowColor = String(config.glowColor ?? '#ff2e88')
  const glowColor2 = String(config.glowColor2 ?? '#22e6ff')
  const intensity = Number(config.intensity ?? 0.5)
  const audioReactive = config.audioReactive === true
  const audioIntensity = Number(config.audioIntensity ?? 0.5)

  const audioLevel = useAudioLevel()
  const boostRef = useRef(0)
  boostRef.current = audioReactive ? audioLevel * audioIntensity : 0

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = Math.max(1, Math.round(bounds.width))
    const H = Math.max(1, Math.round(bounds.height))
    canvas.width = W
    canvas.height = H

    let trackY = -50
    let trackSpeed = 0.6
    let nextSweep = 60 + Math.random() * 200

    const tick = () => {
      const boost = boostRef.current

      ctx.fillStyle = '#0d0d14'
      ctx.fillRect(0, 0, W, H)

      // CRT glow, corners
      const glow = ctx.createRadialGradient(W * 0.2, H * 0.1, 0, W * 0.2, H * 0.1, Math.max(W, H) * 0.6)
      glow.addColorStop(0, `${glowColor}22`)
      glow.addColorStop(1, 'transparent')
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, W, H)
      const glow2 = ctx.createRadialGradient(W * 0.8, H * 0.9, 0, W * 0.8, H * 0.9, Math.max(W, H) * 0.6)
      glow2.addColorStop(0, `${glowColor2}18`)
      glow2.addColorStop(1, 'transparent')
      ctx.fillStyle = glow2
      ctx.fillRect(0, 0, W, H)

      // Ambient scanlines
      ctx.globalAlpha = 0.08 + intensity * 0.06
      ctx.fillStyle = '#000000'
      for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1)
      ctx.globalAlpha = 1

      // Tracking-error sweep band
      nextSweep -= 1
      if (nextSweep <= 0) {
        trackY = -40
        nextSweep = 240 + Math.random() * 300
      }
      if (trackY < H + 40) {
        trackY += trackSpeed * (1 + boost * 3)
        const bandH = 18 + boost * 30
        ctx.globalAlpha = 0.5 + boost * 0.4
        const band = ctx.createLinearGradient(0, trackY - bandH, 0, trackY + bandH)
        band.addColorStop(0, 'transparent')
        band.addColorStop(0.5, glowColor)
        band.addColorStop(1, 'transparent')
        ctx.fillStyle = band
        ctx.fillRect(0, trackY - bandH, W, bandH * 2)
        ctx.globalAlpha = 1
      }

      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [bounds.width, bounds.height, glowColor, glowColor2, intensity])

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
}
