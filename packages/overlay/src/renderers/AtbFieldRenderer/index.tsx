import { useEffect, useRef } from 'react'
import type { RendererProps } from '../registry'

interface Star { x: number; y: number; z: number }

/** ATB-FIELD — Save Point. A slow-filling gauge sits ambient in the corner,
 *  filling toward a stream goal instead of ticking on a clock, over a
 *  starfield-parallax dungeon backdrop. */
export function AtbFieldRenderer({ config, bounds }: RendererProps) {
  const fillColor = String(config.fillColor ?? '#5b7cff')
  const trackColor = String(config.trackColor ?? '#0c1226')
  const progress = Math.max(0, Math.min(1, Number(config.progress ?? 0.4)))
  const starDensity = Number(config.starDensity ?? 0.5)

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

    const starCount = Math.round(40 + starDensity * 120)
    const stars: Star[] = Array.from({ length: starCount }, () => ({
      x: (Math.random() - 0.5) * W,
      y: (Math.random() - 0.5) * H,
      z: Math.random() * W,
    }))

    let pulse = 0

    const tick = () => {
      pulse += 0.02
      const sky = ctx.createLinearGradient(0, 0, 0, H)
      sky.addColorStop(0, '#0c1226')
      sky.addColorStop(1, '#050810')
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, W, H)

      // Parallax starfield
      ctx.fillStyle = '#c8d3ff'
      for (const s of stars) {
        s.z -= 0.6
        if (s.z <= 1) s.z = W
        const k = 128 / s.z
        const sx = s.x * k + W / 2
        const sy = s.y * k + H / 2
        if (sx < 0 || sx > W || sy < 0 || sy > H) continue
        const size = (1 - s.z / W) * 2.2
        ctx.globalAlpha = 1 - s.z / W
        ctx.fillRect(sx, sy, size, size)
      }
      ctx.globalAlpha = 1

      // ATB gauge, bottom-left corner
      const gaugeW = W * 0.26
      const gaugeH = 12
      const gx = 28
      const gy = H - 40
      ctx.fillStyle = trackColor
      ctx.fillRect(gx, gy, gaugeW, gaugeH)
      ctx.strokeStyle = fillColor
      ctx.lineWidth = 1.5
      ctx.strokeRect(gx, gy, gaugeW, gaugeH)
      const fillW = gaugeW * progress
      const grad = ctx.createLinearGradient(gx, 0, gx + fillW, 0)
      grad.addColorStop(0, fillColor)
      grad.addColorStop(1, '#ffd166')
      ctx.fillStyle = grad
      ctx.globalAlpha = 0.85 + 0.15 * Math.sin(pulse)
      ctx.fillRect(gx, gy, fillW, gaugeH)
      ctx.globalAlpha = 1

      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [bounds.width, bounds.height, fillColor, trackColor, progress, starDensity])

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
}
