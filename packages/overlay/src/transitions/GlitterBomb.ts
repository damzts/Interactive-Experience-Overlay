import type { GlitterBombConfig } from '@ieomlabs/shared'

const DEFAULT_COLORS = ['#ffd700', '#ff77ff', '#77e6ff', '#b0ff77', '#ffffff', '#ffaa55']
const W = 1920, H = 1080

interface Fleck {
  x: number; y: number
  vx: number; vy: number
  size: number
  color: string
  twinklePhase: number
  twinkleSpeed: number
  spin: number
  rot: number
}

/** GLITTER-BOMB — twinkling glitter explosion from screen center. */
export function runGlitterBomb(cfg: GlitterBombConfig) {
  const container = document.getElementById('tl-glitter-bomb')
  if (!container) return

  const colors = cfg.colors?.length ? cfg.colors : DEFAULT_COLORS
  const count  = cfg.count ?? 160

  const canvas = document.createElement('canvas')
  canvas.width  = W
  canvas.height = H
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%'
  container.style.display = 'block'
  container.appendChild(canvas)
  const ctx = canvas.getContext('2d')!

  const flecks: Fleck[] = []
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = 4 + Math.random() * 14
    flecks.push({
      x: W / 2, y: H / 2,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 3,
      size: 2.5 + Math.random() * 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      twinklePhase: Math.random() * Math.PI * 2,
      twinkleSpeed: 0.25 + Math.random() * 0.35,
      spin: (Math.random() - 0.5) * 0.3,
      rot: Math.random() * Math.PI,
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
    const envelope = Math.min(1, (1 - t) / 0.25)

    for (const f of flecks) {
      f.x += f.vx
      f.y += f.vy
      f.vx *= 0.985
      f.vy = f.vy * 0.985 + 0.16
      f.rot += f.spin
      f.twinklePhase += f.twinkleSpeed
      // Twinkle: alpha strobes between dim and bright
      const twinkle = 0.35 + 0.65 * Math.abs(Math.sin(f.twinklePhase))
      ctx.globalAlpha = twinkle * envelope
      ctx.save()
      ctx.translate(f.x, f.y)
      ctx.rotate(f.rot)
      ctx.fillStyle = f.color
      ctx.shadowColor = f.color
      ctx.shadowBlur = 8
      ctx.fillRect(-f.size / 2, -f.size / 2, f.size, f.size)
      ctx.restore()
    }
    ctx.globalAlpha = 1
    frame++
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)
}
