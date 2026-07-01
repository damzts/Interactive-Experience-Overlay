import gsap from 'gsap'
import type { ImpactFrameConfig } from '@ieomlabs/shared'

/** IMPACT-FRAME — Flash white → radial ink lines → bold kanji/text slams in. */
export function runImpactFrame(cfg: ImpactFrameConfig) {
  const container = document.getElementById('tl-impact-frame')
  if (!container) return

  const text  = cfg.text  ?? '衝撃'
  const color = cfg.color ?? '#ffffff'

  gsap.set(container, { display: 'block' })
  container.innerHTML = ''

  // Flash div
  const flash = document.createElement('div')
  flash.style.cssText = 'position:absolute;inset:0;background:#ffffff;opacity:0'
  container.appendChild(flash)

  // Ink radial lines canvas
  const canvas = document.createElement('canvas')
  canvas.width  = 1920
  canvas.height = 1080
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;opacity:0'
  container.appendChild(canvas)
  const ctx = canvas.getContext('2d')!
  const cx = 960, cy = 540

  // Draw ink speed lines
  ctx.save()
  ctx.strokeStyle = '#000'
  for (let i = 0; i < 64; i++) {
    const angle = (i / 64) * Math.PI * 2
    const w = 1 + Math.random() * 5
    ctx.lineWidth = w
    ctx.globalAlpha = 0.6 + Math.random() * 0.4
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(angle) * (80 + Math.random() * 60), cy + Math.sin(angle) * (80 + Math.random() * 60))
    ctx.lineTo(cx + Math.cos(angle) * 1300, cy + Math.sin(angle) * 900)
    ctx.stroke()
  }
  ctx.restore()

  // Impact text
  const impactText = document.createElement('div')
  impactText.style.cssText = [
    'position:absolute', 'left:50%', 'top:50%',
    'transform:translate(-50%,-50%) scale(3)',
    'font-family:Impact,"MS Gothic",monospace',
    'font-size:200px',
    `color:${color}`,
    'text-shadow:-4px -4px 0 #000,4px -4px 0 #000,-4px 4px 0 #000,4px 4px 0 #000,0 0 40px rgba(255,255,255,0.8)',
    'letter-spacing:-4px',
    'white-space:nowrap',
    'opacity:0',
  ].join(';')
  impactText.textContent = text
  container.appendChild(impactText)

  const holdSec = cfg.duration - 0.9

  gsap.timeline()
    .to(flash, { opacity: 1, duration: 0.06 })
    .to(flash, { opacity: 0, duration: 0.1 })
    .to(canvas, { opacity: 1, duration: 0.05 }, '<')
    .to(impactText, { opacity: 1, scale: 1, duration: 0.15, ease: 'back.out(2)', transformOrigin: '50% 50%' }, '<0.05')
    .to([canvas, impactText], { opacity: 0, duration: 0.4, delay: holdSec })
    .call(() => { container.innerHTML = ''; gsap.set(container, { display: 'none' }) })
}
