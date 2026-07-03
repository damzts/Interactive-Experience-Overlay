import type { StarfallConfig } from '@ieomlabs/shared'

const DEFAULT_COLORS = ['#ffffff', '#8df6ff', '#ffe14a', '#ff88ff', '#88ffb0']
const W = 1920, H = 1080

interface Star {
  x: number; y: number
  vx: number; vy: number
  size: number
  color: string
  born: number       // frame the star starts falling
  trail: { x: number; y: number }[]
}

/** STARFALL — shooting stars streak diagonally with glowing trails. */
export function runStarfall(cfg: StarfallConfig) {
  const container = document.getElementById('tl-starfall')
  if (!container) return

  const colors = cfg.colors?.length ? cfg.colors : DEFAULT_COLORS
  const count  = cfg.count ?? 12

  const canvas = document.createElement('canvas')
  canvas.width  = W
  canvas.height = H
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%'
  container.style.display = 'block'
  container.appendChild(canvas)
  const ctx = canvas.getContext('2d')!

  const totalFrames = Math.ceil(cfg.duration * 60)
  const stars: Star[] = []
  for (let i = 0; i < count; i++) {
    const speed = 14 + Math.random() * 10
    const angle = Math.PI * (0.6 + Math.random() * 0.15) // down-left diagonal
    stars.push({
      x: 200 + Math.random() * (W - 100),
      y: -40 - Math.random() * 150,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 2 + Math.random() * 2.5,
      color: colors[Math.floor(Math.random() * colors.length)],
      born: Math.floor(Math.random() * totalFrames * 0.6),
      trail: [],
    })
  }

  let frame = 0

  const loop = () => {
    if (frame >= totalFrames) {
      canvas.remove()
      container.style.display = 'none'
      return
    }
    ctx.clearRect(0, 0, W, H)
    const t = frame / totalFrames
    const envelope = Math.min(1, (1 - t) / 0.15)
    ctx.globalCompositeOperation = 'lighter'

    for (const s of stars) {
      if (frame < s.born) continue
      s.x += s.vx
      s.y += s.vy
      s.trail.unshift({ x: s.x, y: s.y })
      if (s.trail.length > 22) s.trail.pop()

      // Trail: fading segments
      for (let i = 1; i < s.trail.length; i++) {
        const a = (1 - i / s.trail.length) * 0.7 * envelope
        ctx.strokeStyle = s.color
        ctx.globalAlpha = a
        ctx.lineWidth = s.size * (1 - i / s.trail.length) * 1.6
        ctx.beginPath()
        ctx.moveTo(s.trail[i - 1].x, s.trail[i - 1].y)
        ctx.lineTo(s.trail[i].x, s.trail[i].y)
        ctx.stroke()
      }

      // Head: bright core + glow
      ctx.globalAlpha = envelope
      ctx.shadowColor = s.color
      ctx.shadowBlur = 16
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
    }
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    frame++
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)
}
