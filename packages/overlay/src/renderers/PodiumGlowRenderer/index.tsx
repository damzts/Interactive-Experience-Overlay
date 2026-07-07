import { useEffect, useRef } from 'react'
import type { RendererProps } from '../registry'

/** PODIUM-GLOW — Podium Chrome. A warm gold floor-light rises behind the
 *  scene; sits dim and ambient otherwise so the light itself signals that
 *  the leaderboard changed when it brightens. */
export function PodiumGlowRenderer({ config, bounds }: RendererProps) {
  const glowColor = String(config.glowColor ?? '#f5d67a')
  const baseColor = String(config.baseColor ?? '#1a1608')
  const brightness = Math.max(0, Math.min(1, Number(config.brightness ?? 0.35)))

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)
  const brightnessRef = useRef(brightness)
  brightnessRef.current = brightness

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = Math.max(1, Math.round(bounds.width))
    const H = Math.max(1, Math.round(bounds.height))
    canvas.width = W
    canvas.height = H

    let phase = 0
    let current = brightnessRef.current

    const tick = () => {
      phase += 0.015
      current += (brightnessRef.current - current) * 0.03

      const bg = ctx.createLinearGradient(0, 0, 0, H)
      bg.addColorStop(0, baseColor)
      bg.addColorStop(1, '#0a0b10')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, W, H)

      const flicker = 0.9 + 0.1 * Math.sin(phase)
      const r = Math.max(W, H) * (0.35 + current * 0.35)
      const glow = ctx.createRadialGradient(W / 2, H * 1.05, 0, W / 2, H * 1.05, r)
      glow.addColorStop(0, glowColor)
      glow.addColorStop(0.4, `${glowColor}55`)
      glow.addColorStop(1, 'transparent')
      ctx.globalAlpha = (0.35 + current * 0.65) * flicker
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, W, H)
      ctx.globalAlpha = 1

      // Subtle rising sparkle motes
      ctx.fillStyle = glowColor
      for (let i = 0; i < 24; i++) {
        const x = (i * 137 + phase * 20) % W
        const y = H - ((i * 61 + phase * 40) % H)
        ctx.globalAlpha = 0.15 * current + 0.05
        ctx.fillRect(x, y, 2, 2)
      }
      ctx.globalAlpha = 1

      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [bounds.width, bounds.height, glowColor, baseColor])

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
}
