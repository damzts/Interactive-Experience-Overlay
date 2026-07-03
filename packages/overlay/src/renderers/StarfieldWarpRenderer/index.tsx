import { useEffect, useRef } from 'react'
import type { RendererProps } from '../registry'

interface Star {
  angle: number
  dist: number
  speed: number
  hue: number
}

/** STARFIELD-WARP — hyperspace star streaks radiating from screen center. */
export function StarfieldWarpRenderer({ config, bounds }: RendererProps) {
  const color   = String(config.color ?? '#ffffff')
  const rainbow = config.rainbow === true
  const density = Math.max(0.1, Math.min(1, Number(config.density ?? 0.5)))
  const speed   = Number(config.speed ?? 1)

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

    const cx = W / 2
    const cy = H / 2
    const maxDist = Math.hypot(cx, cy)
    const count = Math.round(80 + density * 220)

    const spawn = (): Star => ({
      angle: Math.random() * Math.PI * 2,
      dist: Math.random() * maxDist * 0.4,
      speed: 0.6 + Math.random() * 1.8,
      hue: Math.random() * 360,
    })
    const stars: Star[] = Array.from({ length: count }, spawn)

    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, W, H)

    const tick = () => {
      ctx.fillStyle = 'rgba(0,0,0,0.35)'
      ctx.fillRect(0, 0, W, H)

      for (let i = 0; i < stars.length; i++) {
        const s = stars[i]
        const prev = s.dist
        // Accelerate outward — the further out, the faster
        s.dist += (0.4 + (s.dist / maxDist) * 14) * s.speed * speed
        if (s.dist > maxDist) {
          stars[i] = spawn()
          continue
        }
        const brightness = Math.min(1, s.dist / (maxDist * 0.35))
        ctx.strokeStyle = rainbow ? `hsl(${s.hue},100%,70%)` : color
        ctx.globalAlpha = brightness
        ctx.lineWidth = 1 + brightness * 1.6
        ctx.beginPath()
        ctx.moveTo(cx + Math.cos(s.angle) * prev, cy + Math.sin(s.angle) * prev)
        ctx.lineTo(cx + Math.cos(s.angle) * s.dist, cy + Math.sin(s.angle) * s.dist)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [bounds.width, bounds.height, color, rainbow, density, speed])

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
}
