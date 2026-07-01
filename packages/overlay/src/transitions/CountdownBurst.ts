import gsap from 'gsap'
import type { CountdownBurstConfig } from '@ieomlabs/shared'

/** COUNTDOWN-BURST — 3 → 2 → 1 numbers slam onto screen sequentially. */
export function runCountdownBurst(cfg: CountdownBurstConfig) {
  const container = document.getElementById('tl-countdown-burst')
  if (!container) return

  const from  = cfg.from  ?? 3
  const color = cfg.color ?? '#ffffff'

  gsap.set(container, { display: 'block' })
  container.innerHTML = ''

  for (let i = from; i >= 1; i--) {
    const delay = (from - i) * 1.0

    const num = document.createElement('div')
    num.style.cssText = [
      'position:absolute', 'left:50%', 'top:50%',
      'transform:translate(-50%,-50%) scale(2)',
      'font-family:VT323,monospace', 'font-size:200px',
      `color:${color}`,
      `text-shadow:0 0 60px ${color}`,
      'opacity:0', 'pointer-events:none',
    ].join(';')
    num.textContent = String(i)
    container.appendChild(num)

    gsap.timeline({ delay })
      .to(num, { opacity: 1, scale: 1, duration: 0.2, ease: 'back.out(1.5)', transformOrigin: '50% 50%' })
      .to(num, { opacity: 0, scale: 0.6, duration: 0.3, ease: 'power2.in', delay: 0.5 })
      .call(() => num.remove())
  }

  gsap.delayedCall(from * 1.0 + 0.5, () => {
    container.innerHTML = ''
    gsap.set(container, { display: 'none' })
  })
}
