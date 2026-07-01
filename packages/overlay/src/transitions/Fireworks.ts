import type { FireworksConfig } from '@ieomlabs/shared'

const DEFAULT_COLORS = ['#ff4444', '#44aaff', '#ffee44', '#44ff88', '#ff88ff', '#ff8800', '#ffffff']
const W = 1920, H = 1080

interface Particle {
  x: number; y: number
  vx: number; vy: number
  color: string; alpha: number; size: number
}

/** FIREWORKS — star particles arc outward from multiple burst points. */
export function runFireworks(cfg: FireworksConfig) {
  const container = document.getElementById('tl-fireworks')
  if (!container) return

  const colors     = cfg.colors?.length ? cfg.colors : DEFAULT_COLORS
  const burstCount = cfg.count ?? 4

  const canvas = document.createElement('canvas')
  canvas.width  = W
  canvas.height = H
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%'
  container.style.display = 'block'
  container.appendChild(canvas)
  const ctx = canvas.getContext('2d')!

  const particles: Particle[] = []
  for (let b = 0; b < burstCount; b++) {
    const cx    = 300 + Math.random() * (W - 600)
    const cy    = 150 + Math.random() * (H * 0.45)
    const color = colors[Math.floor(Math.random() * colors.length)]
    const n     = 28 + Math.floor(Math.random() * 18)
    for (let i = 0; i < n; i++) {
      const angle = (Math.PI * 2 * i) / n
      const speed = 3.5 + Math.random() * 5
      particles.push({ x: cx, y: cy, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 1.5, color, alpha: 1, size: 2 + Math.random() * 3 })
    }
  }

  let frame = 0
  const totalFrames = Math.ceil(cfg.duration * 60)

  const loop = () => {
    if (frame >= totalFrames) {
      canvas.remove()
      container.style.display = 'none'
      return
    }
    ctx.clearRect(0, 0, W, H)
    const t = frame / totalFrames
    for (const p of particles) {
      p.x  += p.vx
      p.y  += p.vy
      p.vy += 0.14
      p.vx *= 0.98
      p.alpha = Math.max(0, 1 - t * 1.3)
      ctx.globalAlpha = p.alpha
      ctx.fillStyle   = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    frame++
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)
}
