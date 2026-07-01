import gsap from 'gsap'
import type { XpGainConfig } from '@ieomlabs/shared'

const W = 1920, H = 1080

/** XP-GAIN — floating "+XP" text bubbles drift upward from a center band. */
export function runXpGain(cfg: XpGainConfig) {
  const container = document.getElementById('tl-xp-gain')
  if (!container) return

  const count    = cfg.count ?? 5
  const color    = cfg.color ?? '#f5c400'
  const fontSize = cfg.fontSize ?? 36

  gsap.set(container, { display: 'block' })

  const els: HTMLElement[] = []
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div')
    el.textContent = cfg.text
    el.style.cssText = [
      'position:absolute',
      `left:${500 + Math.random() * (W - 1000)}px`,
      `top:${H / 2 + (Math.random() - 0.5) * 200}px`,
      'font-family:VT323,monospace',
      `font-size:${fontSize + Math.random() * 14}px`,
      `color:${color}`,
      `text-shadow:0 0 14px ${color}`,
      'opacity:0',
      'pointer-events:none',
      'white-space:nowrap',
      'letter-spacing:2px',
    ].join(';')
    container.appendChild(el)
    els.push(el)
  }

  els.forEach((el, i) => {
    const delay = i * (cfg.duration * 0.12)
    const rise  = 80 + Math.random() * 80
    gsap.timeline({ delay })
      .to(el, { opacity: 1, y: -20, duration: 0.3, ease: 'power2.out' })
      .to(el, { y: `-=${rise}`, duration: cfg.duration * 0.75, ease: 'power1.out' }, '<')
      .to(el, { opacity: 0, duration: 0.35, ease: 'power2.in' }, `-=0.35`)
      .call(() => el.remove())
  })

  gsap.delayedCall(cfg.duration + count * 0.12 + 0.5, () => {
    gsap.set(container, { display: 'none' })
    container.innerHTML = ''
  })
}
