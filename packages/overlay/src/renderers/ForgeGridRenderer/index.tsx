import { useEffect, useRef } from 'react'
import type { RendererProps } from '../registry'
import { useAudioLevel } from '../useAudioLevel'

interface Ember {
  x: number; y: number; vy: number; r: number; drift: number
}

/** FORGE-GRID — Chrome Requiem. A dim red-lit dungeon-floor grid with slow
 *  ember particles; kick drum pulses the grid lines like a heartbeat. */
export function ForgeGridRenderer({ config, bounds }: RendererProps) {
  const gridColor = String(config.gridColor ?? '#c9313a')
  const emberColor = String(config.emberColor ?? '#ff8a4a')
  const cellSize = Number(config.cellSize ?? 22)
  const emberCount = Math.max(0, Math.min(80, Number(config.emberCount ?? 30)))
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

    const embers: Ember[] = Array.from({ length: emberCount }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vy: -(0.2 + Math.random() * 0.5),
      r: 1 + Math.random() * 2,
      drift: Math.random() * Math.PI * 2,
    }))

    const tick = () => {
      const boost = boostRef.current

      ctx.fillStyle = '#0f0f12'
      ctx.fillRect(0, 0, W, H)

      // Vignette floor lighting
      const glow = ctx.createRadialGradient(W / 2, H * 0.9, 0, W / 2, H * 0.9, Math.max(W, H) * 0.7)
      glow.addColorStop(0, `${gridColor}22`)
      glow.addColorStop(1, 'transparent')
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, W, H)

      // Grid, pulsing like a heartbeat with audio
      const alpha = 0.16 + boost * 0.3
      ctx.strokeStyle = gridColor
      ctx.globalAlpha = alpha
      ctx.lineWidth = 1
      for (let x = 0; x <= W; x += cellSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
      }
      for (let y = 0; y <= H; y += cellSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
      }
      ctx.globalAlpha = 1

      // Embers
      ctx.globalCompositeOperation = 'lighter'
      for (const e of embers) {
        e.drift += 0.02
        e.y += e.vy
        e.x += Math.sin(e.drift) * 0.3
        if (e.y < -10) { e.y = H + 10; e.x = Math.random() * W }
        const r = e.r * (1 + boost)
        const grad = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, r * 4)
        grad.addColorStop(0, emberColor)
        grad.addColorStop(1, 'transparent')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(e.x, e.y, r * 4, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalCompositeOperation = 'source-over'

      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [bounds.width, bounds.height, gridColor, emberColor, cellSize, emberCount])

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
}
