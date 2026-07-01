import gsap from 'gsap'
import type { DramaticZoomConfig } from '@ieomlabs/shared'

/** DRAMATIC-ZOOM — Slow camera zoom in on overlay-root + radial speed lines. */
export function runDramaticZoom(cfg: DramaticZoomConfig) {
  const container = document.getElementById('tl-dramatic-zoom')
  if (!container) return

  const zoomTo   = cfg.zoomTo   ?? 1.08
  const duration = cfg.duration ?? 3
  const color    = cfg.color    ?? 'rgba(0,0,0,0.15)'

  gsap.set(container, { display: 'block' })
  container.innerHTML = ''

  // Speed lines canvas for tension
  const canvas = document.createElement('canvas')
  canvas.width  = 1920
  canvas.height = 1080
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;opacity:0'
  container.appendChild(canvas)
  const ctx = canvas.getContext('2d')!

  const cx = 960, cy = 540
  const lines = Array.from({ length: 40 }, (_, i) => ({
    angle: (i / 40) * Math.PI * 2,
    width: 0.3 + Math.random() * 1.5,
  }))

  ctx.save()
  ctx.strokeStyle = '#000'
  for (const l of lines) {
    ctx.lineWidth = l.width
    ctx.globalAlpha = 0.08 + Math.random() * 0.12
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(l.angle) * 80, cy + Math.sin(l.angle) * 80)
    ctx.lineTo(cx + Math.cos(l.angle) * 1400, cy + Math.sin(l.angle) * 1000)
    ctx.stroke()
  }
  ctx.restore()

  // Dark vignette for drama
  const vignette = document.createElement('div')
  vignette.style.cssText = [
    'position:absolute', 'inset:0',
    `background:radial-gradient(ellipse at center, transparent 40%, ${color} 100%)`,
    'opacity:0',
  ].join(';')
  container.appendChild(vignette)

  const root = document.getElementById('overlay-root')

  gsap.timeline()
    .to(canvas, { opacity: 1, duration: 0.5 })
    .to(vignette, { opacity: 1, duration: 0.8 }, '<')
    .to(root, { scale: zoomTo, duration: duration * 0.7, ease: 'power1.in', transformOrigin: '50% 50%' }, '<')
    // Hold at peak zoom then zoom back out
    .to(root, { scale: 1, duration: duration * 0.3, ease: 'power2.out' })
    .to([canvas, vignette], { opacity: 0, duration: 0.4 }, '<')
    .call(() => { container.innerHTML = ''; gsap.set(container, { display: 'none' }) })
}
