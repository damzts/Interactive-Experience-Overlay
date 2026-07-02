import { useEffect, useRef } from 'react'
import type { RendererProps } from '../registry'

/** WINAMP-VIZ — Winamp-skin bar visualizer + oscilloscope. No real audio tap available,
 *  so bars are driven by a smoothed noise walk to stay lively without external input. */
export function WinampVizRenderer({ config, bounds }: RendererProps) {
  const barColor  = String(config.barColor  ?? '#00ff41')
  const peakColor = String(config.peakColor ?? '#ffffff')
  const bgColor   = String(config.bgColor   ?? '#0a0a0a')
  const barCount  = Number(config.barCount  ?? 20)
  const mode      = String(config.mode ?? 'bars') // 'bars' | 'scope' | 'both'

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef(0)
  const stateRef  = useRef({ levels: new Array(barCount).fill(0), peaks: new Array(barCount).fill(0), t: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = Math.max(1, Math.round(bounds.width))
    const H = Math.max(1, Math.round(bounds.height))
    canvas.width = W
    canvas.height = H

    stateRef.current.levels = new Array(barCount).fill(0)
    stateRef.current.peaks  = new Array(barCount).fill(0)

    const tick = () => {
      const s = stateRef.current
      s.t += 0.06
      ctx.fillStyle = bgColor
      ctx.fillRect(0, 0, W, H)

      if (mode === 'bars' || mode === 'both') {
        const barW = W / barCount
        for (let i = 0; i < barCount; i++) {
          const target = Math.abs(Math.sin(s.t * (0.6 + i * 0.07) + i)) * 0.7 + Math.random() * 0.3
          s.levels[i] += (target - s.levels[i]) * 0.35
          s.peaks[i] = Math.max(s.peaks[i] - 0.015, s.levels[i])
          const h = s.levels[i] * H
          ctx.fillStyle = barColor
          ctx.fillRect(i * barW + 1, H - h, barW - 2, h)
          ctx.fillStyle = peakColor
          ctx.fillRect(i * barW + 1, H - s.peaks[i] * H - 2, barW - 2, 2)
        }
      }
      if (mode === 'scope' || mode === 'both') {
        ctx.strokeStyle = barColor
        ctx.lineWidth = 1.5
        ctx.beginPath()
        for (let x = 0; x < W; x++) {
          const y = H / 2 + Math.sin(x * 0.05 + s.t * 3) * (H * 0.18) * (0.5 + Math.sin(s.t) * 0.5)
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [bounds.width, bounds.height, barCount, barColor, peakColor, bgColor, mode])

  return (
    <div style={{ position: 'absolute', inset: 0, border: `1px solid ${barColor}55`, boxShadow: `inset 0 0 12px ${barColor}22` }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
    </div>
  )
}
