import type { AuroraWaveConfig } from '@ieomlabs/shared'

const DEFAULT_COLORS = ['#00ffc8', '#4488ff', '#cc44ff', '#ff44aa']
const W = 1920, H = 1080

const INTENSITY_ALPHA = { soft: 0.28, medium: 0.45, intense: 0.65 } as const

interface Ribbon {
  baseY: number
  amplitude: number
  wavelength: number
  phase: number
  drift: number
  thickness: number
  color: string
}

/** AURORA-WAVE — flowing aurora ribbons undulate across the screen. */
export function runAuroraWave(cfg: AuroraWaveConfig) {
  const container = document.getElementById('tl-aurora-wave')
  if (!container) return

  const colors    = cfg.colors?.length ? cfg.colors : DEFAULT_COLORS
  const peakAlpha = INTENSITY_ALPHA[cfg.intensity ?? 'medium']

  const canvas = document.createElement('canvas')
  canvas.width  = W
  canvas.height = H
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%'
  container.style.display = 'block'
  container.appendChild(canvas)
  const ctx = canvas.getContext('2d')!

  const ribbons: Ribbon[] = colors.map((color, i) => ({
    baseY: H * (0.2 + (0.5 * i) / Math.max(1, colors.length - 1)),
    amplitude: 60 + Math.random() * 90,
    wavelength: 500 + Math.random() * 500,
    phase: Math.random() * Math.PI * 2,
    drift: 0.6 + Math.random() * 0.9,
    thickness: 110 + Math.random() * 90,
    color,
  }))

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
    // Fade in over the first 15%, out over the last 25%
    const envelope = Math.min(t / 0.15, 1, (1 - t) / 0.25)
    ctx.globalCompositeOperation = 'lighter'

    for (const r of ribbons) {
      r.phase += 0.01 * r.drift
      ctx.beginPath()
      ctx.moveTo(-50, r.baseY)
      for (let x = -50; x <= W + 50; x += 24) {
        const y = r.baseY
          + Math.sin(x / r.wavelength * Math.PI * 2 + r.phase) * r.amplitude
          + Math.sin(x / (r.wavelength * 0.37) + r.phase * 1.7) * r.amplitude * 0.3
        ctx.lineTo(x, y)
      }
      const grad = ctx.createLinearGradient(0, r.baseY - r.thickness, 0, r.baseY + r.thickness)
      grad.addColorStop(0, 'transparent')
      grad.addColorStop(0.5, r.color)
      grad.addColorStop(1, 'transparent')
      ctx.strokeStyle = grad
      ctx.lineWidth = r.thickness
      ctx.lineCap = 'round'
      ctx.globalAlpha = peakAlpha * envelope
      ctx.filter = 'blur(24px)'
      ctx.stroke()
    }
    ctx.filter = 'none'
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    frame++
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)
}
