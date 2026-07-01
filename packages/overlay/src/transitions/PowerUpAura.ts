import gsap from 'gsap'
import type { PowerUpAuraConfig } from '@ieomlabs/shared'

/** POWER-UP-AURA — DBZ-style expanding golden rings + rising aura glow. */
export function runPowerUpAura(cfg: PowerUpAuraConfig) {
  const container = document.getElementById('tl-power-up-aura')
  if (!container) return

  const color    = cfg.color ?? '#f5c400'
  const text     = cfg.text  ?? 'POWER LEVEL RISING'
  const duration = cfg.duration ?? 3.5
  const holdSec  = duration - 1.2

  gsap.set(container, { display: 'block' })
  container.innerHTML = ''

  // Background glow
  const glow = document.createElement('div')
  glow.style.cssText = [
    'position:absolute', 'inset:0',
    `background:radial-gradient(ellipse 60% 80% at 50% 100%, ${color}22 0%, transparent 70%)`,
    'opacity:0',
  ].join(';')
  container.appendChild(glow)

  // 3 expanding rings
  const rings = [0, 0.2, 0.4].map(delay => {
    const ring = document.createElement('div')
    ring.style.cssText = [
      'position:absolute', 'left:50%', 'top:50%',
      'width:80px', 'height:80px',
      'border-radius:50%',
      `border:3px solid ${color}`,
      'transform:translate(-50%,-50%) scale(0)',
      'opacity:0',
    ].join(';')
    container.appendChild(ring)
    gsap.timeline({ delay })
      .to(ring, { opacity: 0.9, scale: 1, duration: 0.15 })
      .to(ring, { scale: 18, opacity: 0, duration: 1.4, ease: 'power2.out' })
    return ring
  })

  // Rising column canvas
  const canvas = document.createElement('canvas')
  canvas.width  = 1920
  canvas.height = 1080
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none'
  container.appendChild(canvas)
  const ctx = canvas.getContext('2d')!

  const particles = Array.from({ length: 60 }, () => ({
    x: 900 + (Math.random() - 0.5) * 120,
    y: 1080 + Math.random() * 200,
    vy: -(3 + Math.random() * 5),
    vx: (Math.random() - 0.5) * 1.5,
    size: 2 + Math.random() * 5,
    alpha: 0.4 + Math.random() * 0.6,
  }))

  let raf = 0
  const drawAura = () => {
    ctx.clearRect(0, 0, 1920, 1080)
    particles.forEach(p => {
      p.y += p.vy
      p.x += p.vx
      p.alpha -= 0.008
      if (p.alpha <= 0) {
        p.y = 1080 + Math.random() * 100
        p.x = 900 + (Math.random() - 0.5) * 120
        p.alpha = 0.4 + Math.random() * 0.6
      }
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2)
      g.addColorStop(0, color + 'cc')
      g.addColorStop(1, color + '00')
      ctx.globalAlpha = p.alpha
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2)
      ctx.fill()
    })
    ctx.globalAlpha = 1
    raf = requestAnimationFrame(drawAura)
  }
  raf = requestAnimationFrame(drawAura)

  // Text
  const label = document.createElement('div')
  label.style.cssText = [
    'position:absolute', 'left:50%', 'top:40%',
    'transform:translate(-50%,-50%)',
    'font-family:Impact,"Arial Black",sans-serif',
    'font-size:48px',
    `color:${color}`,
    `text-shadow:0 0 30px ${color},0 0 60px ${color},-2px -2px 0 #000,2px 2px 0 #000`,
    'letter-spacing:6px',
    'opacity:0',
    'white-space:nowrap',
  ].join(';')
  label.textContent = text
  container.appendChild(label)

  gsap.timeline()
    .to(glow, { opacity: 1, duration: 0.5 })
    .to(label, { opacity: 1, y: -20, duration: 0.6, ease: 'back.out(1.5)' }, '<0.3')
    .to([glow, label], { opacity: 0, duration: 0.5, delay: holdSec })
    .call(() => {
      cancelAnimationFrame(raf)
      rings.forEach(r => r.remove())
      container.innerHTML = ''
      gsap.set(container, { display: 'none' })
    })
}
