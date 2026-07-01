import gsap from 'gsap'
import type { ShockwaveConfig } from '@ieomlabs/shared'

/** SHOCKWAVE — expanding ring pulse from screen center. */
export function runShockwave(cfg: ShockwaveConfig) {
  const container = document.getElementById('tl-shockwave')
  if (!container) return

  const color     = cfg.color     ?? '#ffffff'
  const thickness = cfg.thickness ?? 4

  gsap.set(container, { display: 'block' })
  container.innerHTML = ''

  // Two rings for more impact
  for (let i = 0; i < 2; i++) {
    const ring = document.createElement('div')
    ring.style.cssText = [
      'position:absolute', 'left:50%', 'top:50%',
      'width:100px', 'height:100px', 'border-radius:50%',
      `border:${thickness}px solid ${color}`,
      'transform:translate(-50%,-50%) scale(0)',
      `box-shadow:0 0 20px ${color}88`,
      'opacity:1',
    ].join(';')
    container.appendChild(ring)

    gsap.timeline({ delay: i * 0.15 })
      .to(ring, { scale: 22, opacity: 0, duration: cfg.duration * 0.85, ease: 'power1.out' })
      .call(() => ring.remove())
  }

  gsap.delayedCall(cfg.duration, () => {
    gsap.set(container, { display: 'none' })
    container.innerHTML = ''
  })
}
