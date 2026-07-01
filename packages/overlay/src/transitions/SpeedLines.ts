import gsap from 'gsap'
import type { SpeedLinesConfig } from '@ieomlabs/shared'

/** SPEED-LINES — Canvas radial speed lines radiating from screen center. */
export function runSpeedLines(cfg: SpeedLinesConfig) {
  const container = document.getElementById('tl-speed-lines')
  if (!container) return

  const color     = cfg.color     ?? '#ffffff'
  const density   = cfg.density   ?? 48
  const duration  = cfg.duration  ?? 1.5
  const direction = cfg.direction ?? 'out'

  gsap.set(container, { display: 'block' })
  container.innerHTML = ''

  const canvas = document.createElement('canvas')
  canvas.width  = 1920
  canvas.height = 1080
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%'
  container.appendChild(canvas)

  const ctx = canvas.getContext('2d')!
  const cx = 960, cy = 540
  const maxLen = Math.hypot(cx, cy) + 50

  // Pre-compute line angles
  const lines = Array.from({ length: density }, (_, i) => ({
    angle: (i / density) * Math.PI * 2 + (Math.random() - 0.5) * (Math.PI / density),
    width: 0.5 + Math.random() * 3,
    offset: 60 + Math.random() * 120,
  }))

  const proxy = { progress: 0, opacity: 0 }

  gsap.timeline()
    .to(proxy, { opacity: 1, duration: 0.08,
      onUpdate() {
        ctx.clearRect(0, 0, 1920, 1080)
        ctx.save()
        ctx.globalAlpha = proxy.opacity
        ctx.strokeStyle = color
        for (const l of lines) {
          const startR = direction === 'out' ? l.offset + proxy.progress * 80 : maxLen - l.offset - proxy.progress * 80
          const endR   = direction === 'out' ? startR + maxLen * proxy.progress : startR - maxLen * proxy.progress
          ctx.lineWidth = l.width
          ctx.beginPath()
          ctx.moveTo(cx + Math.cos(l.angle) * startR, cy + Math.sin(l.angle) * startR)
          ctx.lineTo(cx + Math.cos(l.angle) * Math.max(0, endR), cy + Math.sin(l.angle) * Math.max(0, endR))
          ctx.stroke()
        }
        ctx.restore()
      },
    })
    .to(proxy, {
      progress: 1,
      duration: duration * 0.75,
      ease: 'power2.in',
      onUpdate() {
        ctx.clearRect(0, 0, 1920, 1080)
        ctx.save()
        ctx.globalAlpha = proxy.opacity * (1 - proxy.progress * 0.3)
        ctx.strokeStyle = color
        for (const l of lines) {
          const startR = direction === 'out' ? l.offset + proxy.progress * 80 : maxLen - l.offset - proxy.progress * 80
          const endR   = direction === 'out' ? startR + maxLen * proxy.progress : startR - maxLen * proxy.progress
          ctx.lineWidth = l.width
          ctx.beginPath()
          ctx.moveTo(cx + Math.cos(l.angle) * startR, cy + Math.sin(l.angle) * startR)
          ctx.lineTo(cx + Math.cos(l.angle) * Math.max(0, endR), cy + Math.sin(l.angle) * Math.max(0, endR))
          ctx.stroke()
        }
        ctx.restore()
      },
    })
    .to(proxy, { opacity: 0, duration: duration * 0.25 })
    .call(() => { container.innerHTML = ''; gsap.set(container, { display: 'none' }) })
}
