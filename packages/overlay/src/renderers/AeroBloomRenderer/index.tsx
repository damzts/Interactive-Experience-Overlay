import { useEffect, useRef } from 'react'
import type { RendererProps } from '../registry'
import { useAudioLevel } from '../useAudioLevel'

interface Bokeh {
  x: number; y: number; r: number; vy: number; phase: number
}

/** AERO-BLOOM — Aero Saint. Slow-drifting glass bokeh over a soft aurora wash;
 *  bass swells push a bloom halo outward instead of just brightening a border. */
export function AeroBloomRenderer({ config, bounds }: RendererProps) {
  const skyTop  = String(config.skyTop ?? '#0d2233')
  const glassColor = String(config.glassColor ?? '#bfe9ff')
  const auroraColor = String(config.auroraColor ?? '#6fd1ff')
  const density = Number(config.density ?? 0.5)
  const speed   = Number(config.speed ?? 1)
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

    const count = Math.round(10 + density * 30)
    const bokeh: Bokeh[] = Array.from({ length: count }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.min(W, H) * (0.02 + Math.random() * 0.05),
      vy: -(0.1 + Math.random() * 0.25) * speed,
      phase: Math.random() * Math.PI * 2,
    }))

    const tick = () => {
      const boost = boostRef.current

      const sky = ctx.createLinearGradient(0, 0, 0, H)
      sky.addColorStop(0, skyTop)
      sky.addColorStop(1, '#04121d')
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, W, H)

      // Aurora ribbon wash
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      ctx.filter = 'blur(40px)'
      const auroraGrad = ctx.createRadialGradient(W * 0.7, H * 0.2, 0, W * 0.7, H * 0.2, Math.max(W, H) * (0.35 + boost * 0.15))
      auroraGrad.addColorStop(0, auroraColor)
      auroraGrad.addColorStop(1, 'transparent')
      ctx.fillStyle = auroraGrad
      ctx.fillRect(0, 0, W, H)
      ctx.restore()

      // Bokeh bubbles
      ctx.globalCompositeOperation = 'lighter'
      for (const b of bokeh) {
        b.phase += 0.008 * speed
        b.y += b.vy
        if (b.y < -b.r * 2) { b.y = H + b.r; b.x = Math.random() * W }
        const r = b.r * (1 + boost * 0.5) * (0.9 + 0.1 * Math.sin(b.phase))
        const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r)
        grad.addColorStop(0, glassColor)
        grad.addColorStop(0.6, `${glassColor}33`)
        grad.addColorStop(1, 'transparent')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(b.x, b.y, r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalCompositeOperation = 'source-over'

      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [bounds.width, bounds.height, skyTop, glassColor, auroraColor, density, speed])

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
}
