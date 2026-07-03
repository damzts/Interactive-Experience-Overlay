import type { BubblePopConfig } from '@ieomlabs/shared'

const DEFAULT_COLORS = ['#8df6ff', '#ff9ee7', '#b7ff9e', '#ffd88d', '#c49eff']
const W = 1920, H = 1080

interface Bubble {
  x: number; y: number
  r: number
  vy: number
  wobblePhase: number
  wobbleSpeed: number
  color: string
  popAtY: number
  popped: boolean
}

interface Droplet {
  x: number; y: number
  vx: number; vy: number
  color: string
  alpha: number
}

/** BUBBLE-POP — glossy iridescent bubbles rise, wobble, and pop into droplets. */
export function runBubblePop(cfg: BubblePopConfig) {
  const container = document.getElementById('tl-bubble-pop')
  if (!container) return

  const colors = cfg.colors?.length ? cfg.colors : DEFAULT_COLORS
  const count  = cfg.count ?? 24

  const canvas = document.createElement('canvas')
  canvas.width  = W
  canvas.height = H
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%'
  container.style.display = 'block'
  container.appendChild(canvas)
  const ctx = canvas.getContext('2d')!

  const bubbles: Bubble[] = []
  for (let i = 0; i < count; i++) {
    bubbles.push({
      x: Math.random() * W,
      y: H + 40 + Math.random() * H * 0.8,
      r: 14 + Math.random() * 34,
      vy: 2.2 + Math.random() * 2.6,
      wobblePhase: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.04 + Math.random() * 0.05,
      color: colors[Math.floor(Math.random() * colors.length)],
      popAtY: 60 + Math.random() * H * 0.55,
      popped: false,
    })
  }
  const droplets: Droplet[] = []

  let frame = 0
  const totalFrames = Math.ceil(cfg.duration * 60)

  const drawBubble = (b: Bubble, alpha: number) => {
    ctx.globalAlpha = alpha
    // Body: translucent tinted sphere
    const grad = ctx.createRadialGradient(b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.1, b.x, b.y, b.r)
    grad.addColorStop(0, 'rgba(255,255,255,0.85)')
    grad.addColorStop(0.25, `${b.color}55`)
    grad.addColorStop(0.9, `${b.color}22`)
    grad.addColorStop(1, `${b.color}88`)
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)
    ctx.fill()
    // Rim
    ctx.strokeStyle = `${b.color}aa`
    ctx.lineWidth = 1.5
    ctx.stroke()
    // Specular highlight
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.beginPath()
    ctx.ellipse(b.x - b.r * 0.4, b.y - b.r * 0.45, b.r * 0.18, b.r * 0.1, -0.6, 0, Math.PI * 2)
    ctx.fill()
  }

  const loop = () => {
    if (frame >= totalFrames) {
      canvas.remove()
      container.style.display = 'none'
      return
    }
    ctx.clearRect(0, 0, W, H)
    const t = frame / totalFrames
    const envelope = Math.min(t / 0.1, 1, (1 - t) / 0.15)

    for (const b of bubbles) {
      if (b.popped) continue
      b.wobblePhase += b.wobbleSpeed
      b.y -= b.vy
      b.x += Math.sin(b.wobblePhase) * 1.4
      if (b.y <= b.popAtY) {
        b.popped = true
        const n = 6 + Math.floor(Math.random() * 5)
        for (let i = 0; i < n; i++) {
          const angle = (Math.PI * 2 * i) / n
          const speed = 1.5 + Math.random() * 2.5
          droplets.push({ x: b.x, y: b.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, color: b.color, alpha: 1 })
        }
        continue
      }
      drawBubble(b, envelope)
    }

    for (const d of droplets) {
      if (d.alpha <= 0) continue
      d.x += d.vx
      d.y += d.vy
      d.vy += 0.12
      d.alpha -= 0.03
      ctx.globalAlpha = Math.max(0, d.alpha) * envelope
      ctx.fillStyle = d.color
      ctx.beginPath()
      ctx.arc(d.x, d.y, 2.2, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.globalAlpha = 1
    frame++
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)
}
