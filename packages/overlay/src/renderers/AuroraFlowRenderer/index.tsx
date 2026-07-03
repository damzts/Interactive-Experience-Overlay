import { useEffect, useRef } from 'react'
import type { RendererProps } from '../registry'

/** AURORA-FLOW — slowly drifting northern-lights gradient ribbons. */
export function AuroraFlowRenderer({ config, bounds }: RendererProps) {
  const color1  = String(config.color1 ?? '#00ffc8')
  const color2  = String(config.color2 ?? '#4488ff')
  const color3  = String(config.color3 ?? '#cc44ff')
  const speed   = Number(config.speed ?? 1)
  const opacity = Number(config.opacity ?? 0.5)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = Math.max(1, Math.round(bounds.width))
    const H = Math.max(1, Math.round(bounds.height))
    canvas.width = W
    canvas.height = H

    const ribbons = [color1, color2, color3].map((color, i) => ({
      color,
      baseY: H * (0.25 + 0.25 * i),
      amplitude: H * (0.1 + 0.05 * i),
      wavelength: W * (0.5 + 0.2 * i),
      phase: (Math.PI * 2 * i) / 3,
      drift: 0.5 + 0.35 * i,
      thickness: H * 0.22,
    }))

    const tick = () => {
      ctx.clearRect(0, 0, W, H)
      ctx.globalCompositeOperation = 'lighter'
      for (const r of ribbons) {
        r.phase += 0.006 * r.drift * speed
        ctx.beginPath()
        ctx.moveTo(-50, r.baseY)
        for (let x = -50; x <= W + 50; x += 24) {
          const y = r.baseY
            + Math.sin((x / r.wavelength) * Math.PI * 2 + r.phase) * r.amplitude
            + Math.sin(x / (r.wavelength * 0.31) + r.phase * 1.6) * r.amplitude * 0.35
          ctx.lineTo(x, y)
        }
        const grad = ctx.createLinearGradient(0, r.baseY - r.thickness, 0, r.baseY + r.thickness)
        grad.addColorStop(0, 'transparent')
        grad.addColorStop(0.5, r.color)
        grad.addColorStop(1, 'transparent')
        ctx.strokeStyle = grad
        ctx.lineWidth = r.thickness
        ctx.lineCap = 'round'
        ctx.globalAlpha = opacity
        ctx.filter = 'blur(28px)'
        ctx.stroke()
      }
      ctx.filter = 'none'
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [bounds.width, bounds.height, color1, color2, color3, speed, opacity])

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
}
