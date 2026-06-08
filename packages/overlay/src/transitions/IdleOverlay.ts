import gsap from 'gsap'
import type { FloatiesConfig } from '@ieomlabs/shared'

/** IDLE overlay — random terminal/desktop floaties drift across the screen. */

const DEFAULT_ELEMENTS = [
  '█', '▓', '░', '▒', '■', '□', '◆', '◇', '●', '○',
  '⌘', '⌥', '⇧', '⌫', '⎋', '⏎',
  '01', '10', '00', '11', 'FF', 'A3', '7E',
  '[SYS]', '[NET]', '[IO]', '[ERR]', '>_',
]

export function runIdleOverlay(cfg: FloatiesConfig) {
  const container = document.getElementById('tl-idle-container')
  if (!container) return

  container.innerHTML = ''
  gsap.killTweensOf(container)

  const W = 1920
  const H = 1080
  const pool = DEFAULT_ELEMENTS
  const speedMul = cfg.speed
  const tl = gsap.timeline()

  const els: HTMLElement[] = []
  for (let i = 0; i < cfg.count; i++) {
    const el = document.createElement('div')
    el.textContent = pool[Math.floor(Math.random() * pool.length)]
    el.style.cssText = [
      'position:absolute',
      `left:${Math.random() * (W - 120)}px`,
      `top:${Math.random() * (H - 60)}px`,
      'font-family:VT323,monospace',
      `font-size:${14 + Math.floor(Math.random() * 20)}px`,
      `color:hsl(${120 + Math.random() * 60},80%,${50 + Math.random() * 20}%)`,
      'opacity:0',
      'pointer-events:none',
      'white-space:nowrap',
      'text-shadow:0 0 6px currentColor',
    ].join(';')
    container.appendChild(el)
    els.push(el)
  }

  tl.to(els, { opacity: () => 0.4 + Math.random() * 0.5, duration: 0.4 / speedMul, stagger: 0.15 / speedMul, ease: 'power2.out' })

  const driftDur = cfg.duration * 0.8
  els.forEach((el) => {
    const dx = (Math.random() - 0.5) * 300
    const dy = (Math.random() - 0.5) * 200
    gsap.to(el, { x: dx, y: dy, duration: driftDur / speedMul, ease: 'sine.inOut' })
    gsap.to(el, { opacity: () => 0.1 + Math.random() * 0.4, duration: (1.5 + Math.random() * 2) / speedMul, repeat: Math.ceil(cfg.duration / 4), yoyo: true, ease: 'sine.inOut' })
  })

  tl.to(els, { opacity: 0, duration: 1.5 / speedMul, stagger: 0.1 / speedMul, ease: 'power2.in', delay: driftDur * 0.85 / speedMul })
    .call(() => { container.innerHTML = '' })
}
