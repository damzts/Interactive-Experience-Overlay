import type { ConfettiBurstConfig } from '@ieomlabs/shared'

const DEFAULT_COLORS = ['#ff4444', '#44aaff', '#ffee44', '#44ff88', '#ff88ff', '#ff8844', '#44ffee']
const W = 1920, H = 1080

interface Piece {
  x: number; y: number; vx: number; vy: number
  rot: number; vr: number; w: number; h: number
  color: string; alpha: number
}

/** CONFETTI-BURST — colored paper confetti rains from the top. */
export function runConfettiBurst(cfg: ConfettiBurstConfig) {
  const container = document.getElementById('tl-confetti')
  if (!container) return

  const colors = cfg.colors?.length ? cfg.colors : DEFAULT_COLORS
  const count  = cfg.count ?? 120

  const canvas = document.createElement('canvas')
  canvas.width  = W
  canvas.height = H
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%'
  container.style.display = 'block'
  container.appendChild(canvas)
  const ctx = canvas.getContext('2d')!

  const pieces: Piece[] = []
  for (let i = 0; i < count; i++) {
    pieces.push({
      x: Math.random() * W,
      y: -10 - Math.random() * 200,
      vx: (Math.random() - 0.5) * 4,
      vy: 2 + Math.random() * 4,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.18,
      w: 6 + Math.random() * 8,
      h: 3 + Math.random() * 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 1,
    })
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
    for (const p of pieces) {
      p.x   += p.vx
      p.y   += p.vy
      p.vy  += 0.07
      p.rot += p.vr
      if (t > 0.7) p.alpha = Math.max(0, 1 - (t - 0.7) / 0.3)
      ctx.save()
      ctx.globalAlpha = p.alpha
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.fillStyle = p.color
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
      ctx.restore()
    }
    frame++
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)
}
