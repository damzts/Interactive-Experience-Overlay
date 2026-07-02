import { useEffect, useRef } from 'react'
import type { RendererProps } from '../registry'

const GLYPHS = 'ｦｱｳｴｵｶｷｹｺｻｼｽｾｿﾀﾂﾃﾅﾆﾇﾈﾊﾋﾎﾏﾐﾑﾒﾓﾔﾕﾗﾘﾜ0123456789'

interface Column { y: number; speed: number; trail: string[] }

/** MATRIX-RAIN — canvas character rain with configurable color cycling. */
export function MatrixRainRenderer({ config, bounds }: RendererProps) {
  const color     = String(config.color ?? '#00ff41')
  const rainbow   = config.rainbow === true
  const fontSize  = Number(config.fontSize ?? 18)
  const bgOpacity = Number(config.bgOpacity ?? 0.08)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef(0)
  const hueRef    = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = Math.max(1, Math.round(bounds.width))
    const H = Math.max(1, Math.round(bounds.height))
    canvas.width = W
    canvas.height = H

    const cols = Math.max(1, Math.floor(W / fontSize))
    const columns: Column[] = Array.from({ length: cols }, () => ({
      y: Math.random() * -H,
      speed: 2 + Math.random() * 4,
      trail: [],
    }))

    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, W, H)

    const tick = () => {
      ctx.fillStyle = `rgba(0,0,0,${bgOpacity})`
      ctx.fillRect(0, 0, W, H)
      ctx.font = `${fontSize}px monospace`

      if (rainbow) {
        hueRef.current = (hueRef.current + 0.6) % 360
      }
      const glyphColor = rainbow ? `hsl(${hueRef.current},100%,55%)` : color

      columns.forEach((c, i) => {
        const ch = GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
        ctx.fillStyle = '#fff'
        ctx.fillText(ch, i * fontSize, c.y)
        ctx.fillStyle = glyphColor
        ctx.fillText(ch, i * fontSize, c.y - fontSize)
        c.y += c.speed
        if (c.y > H + fontSize * 20 && Math.random() > 0.975) c.y = Math.random() * -H
      })
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [bounds.width, bounds.height, color, rainbow, fontSize, bgOpacity])

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
}
