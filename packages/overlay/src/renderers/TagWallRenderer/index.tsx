import { useEffect, useRef } from 'react'
import type { RendererProps } from '../registry'

interface Tag {
  x: number; y: number; r: number; color: string; age: number; maxAge: number
}

const PALETTE = ['#ff6b35', '#2ee6d6', '#ffd166', '#ff3d81']

/** TAG-WALL — Trick City. Spray-paint blooms build up on a concrete-texture
 *  backdrop; a new tag lands every so often and slowly fades, like a wall
 *  filling up over the course of a session. */
export function TagWallRenderer({ config, bounds }: RendererProps) {
  const wallColor = String(config.wallColor ?? '#1c1c22')
  const spawnMs = Number(config.spawnIntervalMs ?? 4500)
  const maxTags = Math.max(1, Math.min(60, Number(config.maxTags ?? 24)))

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

    const tags: Tag[] = []
    let lastSpawn = 0

    const spawnTag = () => {
      if (tags.length >= maxTags) tags.shift()
      tags.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.min(W, H) * (0.05 + Math.random() * 0.09),
        color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
        age: 0,
        maxAge: 1,
      })
    }
    spawnTag()

    const tick = (t: number) => {
      if (t - lastSpawn > spawnMs) { spawnTag(); lastSpawn = t }

      ctx.fillStyle = wallColor
      ctx.fillRect(0, 0, W, H)

      // Concrete texture — faint noise dots
      ctx.globalAlpha = 0.05
      ctx.fillStyle = '#ffffff'
      for (let i = 0; i < 60; i++) {
        const nx = (i * 97 % W)
        const ny = (i * 53 % H)
        ctx.fillRect(nx, ny, 1.5, 1.5)
      }
      ctx.globalAlpha = 1

      ctx.globalCompositeOperation = 'lighter'
      for (const tag of tags) {
        tag.age = Math.min(1, tag.age + 0.006)
        const fadeIn = Math.min(1, tag.age * 6)
        const grad = ctx.createRadialGradient(tag.x, tag.y, 0, tag.x, tag.y, tag.r)
        grad.addColorStop(0, tag.color)
        grad.addColorStop(0.7, `${tag.color}55`)
        grad.addColorStop(1, 'transparent')
        ctx.globalAlpha = fadeIn * 0.7
        ctx.fillStyle = grad
        ctx.beginPath()
        // Jagged spray splatter — irregular polygon instead of a clean circle
        const spikes = 7
        ctx.moveTo(tag.x + tag.r, tag.y)
        for (let i = 1; i <= spikes; i++) {
          const a = (i / spikes) * Math.PI * 2
          const rr = tag.r * (0.7 + 0.3 * Math.sin(i * 12.9 + tag.x))
          ctx.lineTo(tag.x + Math.cos(a) * rr, tag.y + Math.sin(a) * rr)
        }
        ctx.closePath()
        ctx.fill()
      }
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'

      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [bounds.width, bounds.height, wallColor, spawnMs, maxTags])

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
}
