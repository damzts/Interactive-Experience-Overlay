import { useEffect, useRef } from 'react'
import type { RendererProps } from '../registry'
import { useAudioLevel } from '../useAudioLevel'

/** SYNTHWAVE-GRID — retro-futurist perspective grid scrolling toward a horizon sun. */
export function SynthwaveGridRenderer({ config, bounds }: RendererProps) {
  const gridColor = String(config.gridColor ?? '#ff00cc')
  const sunColor  = String(config.sunColor ?? '#ff6ec7')
  const skyTop    = String(config.skyTop ?? '#0b0033')
  const showSun   = config.showSun !== false
  const speed     = Number(config.speed ?? 1)
  const audioReactive = config.audioReactive === true
  const audioIntensity = Number(config.audioIntensity ?? 0.5)

  const audioLevel = useAudioLevel()
  const glowBoost = audioReactive ? audioLevel * audioIntensity : 0

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef(0)
  const glowBoostRef = useRef(0)
  glowBoostRef.current = glowBoost

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = Math.max(1, Math.round(bounds.width))
    const H = Math.max(1, Math.round(bounds.height))
    canvas.width = W
    canvas.height = H

    const horizonY = H * 0.55
    let scroll = 0

    const tick = () => {
      const boost = glowBoostRef.current

      // Sky
      const sky = ctx.createLinearGradient(0, 0, 0, horizonY)
      sky.addColorStop(0, skyTop)
      sky.addColorStop(1, '#2a0a4a')
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, W, horizonY)

      // Sun with horizontal blind stripes
      if (showSun) {
        const sunR = Math.min(W, H) * (0.22 + boost * 0.06)
        const cx = W / 2
        const cy = horizonY - sunR * 0.15
        const sunGrad = ctx.createLinearGradient(0, cy - sunR, 0, cy + sunR)
        sunGrad.addColorStop(0, '#ffe14a')
        sunGrad.addColorStop(1, sunColor)
        // Glow halo drawn before clipping — shadowBlur is clipped away otherwise
        if (boost > 0) {
          ctx.save()
          ctx.shadowColor = sunColor
          ctx.shadowBlur = 20 + boost * 70
          ctx.fillStyle = sunColor
          ctx.beginPath()
          ctx.arc(cx, cy, sunR, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        }

        ctx.save()
        ctx.beginPath()
        ctx.arc(cx, cy, sunR, 0, Math.PI * 2)
        ctx.clip()
        ctx.fillStyle = sunGrad
        ctx.fillRect(cx - sunR, cy - sunR, sunR * 2, sunR * 2)
        // Blinds: gaps widen toward the bottom of the sun
        ctx.fillStyle = skyTop
        for (let i = 0; i < 7; i++) {
          const y = cy + sunR * (0.05 + i * 0.14)
          ctx.fillRect(cx - sunR, y, sunR * 2, 2 + i * 1.6)
        }
        ctx.restore()
      }

      // Ground
      const ground = ctx.createLinearGradient(0, horizonY, 0, H)
      ground.addColorStop(0, '#1a0a2e')
      ground.addColorStop(1, '#05010d')
      ctx.fillStyle = ground
      ctx.fillRect(0, horizonY, W, H - horizonY)

      ctx.strokeStyle = gridColor
      ctx.shadowColor = gridColor
      ctx.shadowBlur = 6 + boost * 18

      // Vertical lines converge on the vanishing point
      ctx.lineWidth = 1.5
      const vpX = W / 2
      for (let i = -12; i <= 12; i++) {
        ctx.globalAlpha = 0.75
        ctx.beginPath()
        ctx.moveTo(vpX + i * 18, horizonY)
        ctx.lineTo(vpX + i * (W / 12), H)
        ctx.stroke()
      }

      // Horizontal lines scroll toward the viewer with perspective spacing
      scroll = (scroll + 0.004 * speed) % 1
      for (let i = 0; i < 14; i++) {
        const p = ((i + scroll) / 14) ** 2.2
        const y = horizonY + p * (H - horizonY)
        ctx.globalAlpha = 0.35 + p * 0.55
        ctx.lineWidth = 1 + p * 2
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(W, y)
        ctx.stroke()
      }

      ctx.globalAlpha = 1
      ctx.shadowBlur = 0
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [bounds.width, bounds.height, gridColor, sunColor, skyTop, showSun, speed])

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
}
