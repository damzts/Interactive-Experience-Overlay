import { useEffect, useRef } from 'react'
import type { RendererProps } from '../registry'

interface Bubble {
  x: number; y: number; r: number; vy: number; vx: number; phase: number; color: string
}

const PALETTE = ['#ff9ecb', '#9be8ff', '#ffe28a', '#c6a8ff']

/** BUDDY-BLOOM — Dial Tone Dream. Pastel gel bubbles drift like a Y2K
 *  screensaver, gently colliding and separating. */
export function BuddyBloomRenderer({ config, bounds }: RendererProps) {
  const bgTop = String(config.bgTop ?? '#ffffff')
  const bgBottom = String(config.bgBottom ?? '#d9f4ff')
  const count = Math.max(2, Math.min(30, Number(config.count ?? 12)))
  const speed = Number(config.speed ?? 1)

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

    const bubbles: Bubble[] = Array.from({ length: count }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.min(W, H) * (0.03 + Math.random() * 0.05),
      vx: (Math.random() - 0.5) * 0.5 * speed,
      vy: (Math.random() - 0.5) * 0.5 * speed,
      phase: Math.random() * Math.PI * 2,
      color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
    }))

    const tick = () => {
      const bg = ctx.createLinearGradient(0, 0, 0, H)
      bg.addColorStop(0, bgTop)
      bg.addColorStop(1, bgBottom)
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, W, H)

      for (const b of bubbles) {
        b.phase += 0.02
        b.x += b.vx
        b.y += b.vy
        if (b.x < -b.r) b.x = W + b.r
        if (b.x > W + b.r) b.x = -b.r
        if (b.y < -b.r) b.y = H + b.r
        if (b.y > H + b.r) b.y = -b.r

        const r = b.r * (0.95 + 0.05 * Math.sin(b.phase))
        const grad = ctx.createRadialGradient(b.x - r * 0.3, b.y - r * 0.3, 0, b.x, b.y, r)
        grad.addColorStop(0, '#ffffff')
        grad.addColorStop(0.4, b.color)
        grad.addColorStop(1, `${b.color}00`)
        ctx.fillStyle = grad
        ctx.globalAlpha = 0.75
        ctx.beginPath()
        ctx.arc(b.x, b.y, r, 0, Math.PI * 2)
        ctx.fill()

        // Gel highlight
        ctx.globalAlpha = 0.9
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.arc(b.x - r * 0.35, b.y - r * 0.35, r * 0.18, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [bounds.width, bounds.height, bgTop, bgBottom, count, speed])

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
}
