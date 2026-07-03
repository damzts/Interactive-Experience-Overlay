import type { LaserSweepConfig } from '@ieomlabs/shared'

const W = 1920, H = 1080

interface Beam {
  /** 0–1 start offset within the effect's timeline */
  startT: number
  tilt: number
  width: number
  leftToRight: boolean
}

/** LASER-SWEEP — synthwave laser beams sweep across the screen. */
export function runLaserSweep(cfg: LaserSweepConfig) {
  const container = document.getElementById('tl-laser-sweep')
  if (!container) return

  const beamCount = cfg.beams ?? 5
  const rainbow   = cfg.rainbow ?? false
  const baseColor = cfg.color ?? '#ff00cc'

  const canvas = document.createElement('canvas')
  canvas.width  = W
  canvas.height = H
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%'
  container.style.display = 'block'
  container.appendChild(canvas)
  const ctx = canvas.getContext('2d')!

  const beams: Beam[] = Array.from({ length: beamCount }, (_, i) => ({
    startT: (i / beamCount) * 0.6,
    tilt: (Math.random() - 0.5) * 500,
    width: 30 + Math.random() * 50,
    leftToRight: i % 2 === 0,
  }))

  let frame = 0
  const totalFrames = Math.ceil(cfg.duration * 60)
  // Each beam takes 40% of the total duration to cross the screen
  const sweepSpan = 0.4

  const loop = () => {
    if (frame >= totalFrames) {
      canvas.remove()
      container.style.display = 'none'
      return
    }
    ctx.clearRect(0, 0, W, H)
    const t = frame / totalFrames
    ctx.globalCompositeOperation = 'lighter'

    beams.forEach((b, i) => {
      const progress = (t - b.startT) / sweepSpan
      if (progress < 0 || progress > 1) return
      const x = b.leftToRight ? progress * (W + 600) - 300 : W + 300 - progress * (W + 600)
      const color = rainbow ? `hsl(${(i * 65 + t * 360) % 360},100%,60%)` : baseColor
      // Edge fade so beams don't hard-pop at spawn/despawn
      const alpha = Math.sin(progress * Math.PI)

      const grad = ctx.createLinearGradient(x - b.width, 0, x + b.width, 0)
      grad.addColorStop(0, 'transparent')
      grad.addColorStop(0.5, color)
      grad.addColorStop(1, 'transparent')
      ctx.globalAlpha = 0.55 * alpha
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.moveTo(x - b.width + b.tilt, 0)
      ctx.lineTo(x + b.width + b.tilt, 0)
      ctx.lineTo(x + b.width - b.tilt, H)
      ctx.lineTo(x - b.width - b.tilt, H)
      ctx.closePath()
      ctx.fill()

      // Bright core line
      ctx.globalAlpha = 0.9 * alpha
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2
      ctx.shadowColor = color
      ctx.shadowBlur = 18
      ctx.beginPath()
      ctx.moveTo(x + b.tilt, 0)
      ctx.lineTo(x - b.tilt, H)
      ctx.stroke()
      ctx.shadowBlur = 0
    })

    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    frame++
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)
}
