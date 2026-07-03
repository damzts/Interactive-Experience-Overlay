import { useEffect, useRef } from 'react'
import type { RendererProps } from '../registry'

interface Blob {
  x: number; y: number
  r: number
  vx: number; vy: number
  color: string
  pulsePhase: number
}

/** LAVA-LAMP — soft glowing blobs drift and merge like a lava lamp. */
export function LavaLampRenderer({ config, bounds }: RendererProps) {
  const color1    = String(config.color1 ?? '#ff4488')
  const color2    = String(config.color2 ?? '#8844ff')
  const bgColor   = String(config.bgColor ?? '#0a0018')
  const blobCount = Math.max(2, Math.min(12, Number(config.blobCount ?? 6)))
  const speed     = Number(config.speed ?? 1)

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

    const blobs: Blob[] = Array.from({ length: blobCount }, (_, i) => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.min(W, H) * (0.12 + Math.random() * 0.16),
      vx: (Math.random() - 0.5) * 0.7,
      vy: (Math.random() - 0.5) * 0.7,
      color: i % 2 === 0 ? color1 : color2,
      pulsePhase: Math.random() * Math.PI * 2,
    }))

    const tick = () => {
      ctx.fillStyle = bgColor
      ctx.fillRect(0, 0, W, H)
      ctx.globalCompositeOperation = 'lighter'
      ctx.filter = 'blur(32px)'
      for (const b of blobs) {
        b.pulsePhase += 0.01 * speed
        b.x += b.vx * speed
        b.y += b.vy * speed
        if (b.x < -b.r) b.x = W + b.r
        if (b.x > W + b.r) b.x = -b.r
        if (b.y < -b.r) b.y = H + b.r
        if (b.y > H + b.r) b.y = -b.r
        const r = b.r * (0.85 + 0.15 * Math.sin(b.pulsePhase))
        const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r)
        grad.addColorStop(0, b.color)
        grad.addColorStop(1, 'transparent')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(b.x, b.y, r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.filter = 'none'
      ctx.globalCompositeOperation = 'source-over'
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [bounds.width, bounds.height, color1, color2, bgColor, blobCount, speed])

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
}
