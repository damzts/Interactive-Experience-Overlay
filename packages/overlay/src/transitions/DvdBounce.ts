import gsap from 'gsap'
import type { DvdBounceConfig } from '@ieomlabs/shared'

const W = 1920, H = 1080
const COLORS = ['#ff4444', '#44aaff', '#ffee44', '#44ff88', '#ff88ff', '#ff8844']

/** DVD-BOUNCE — text bounces around the screen like the classic DVD screensaver. */
export function runDvdBounce(cfg: DvdBounceConfig) {
  const container = document.getElementById('tl-dvd-bounce')
  if (!container) return

  const text     = cfg.text ?? 'DVD'
  const fontSize = 72
  const elW      = text.length * fontSize * 0.56
  const elH      = fontSize * 1.2

  gsap.set(container, { display: 'block' })

  const el = document.createElement('div')
  el.textContent = text
  el.style.cssText = [
    'position:absolute',
    'font-family:VT323,monospace',
    `font-size:${fontSize}px`,
    'letter-spacing:4px',
    `color:${COLORS[0]}`,
    'pointer-events:none',
    'white-space:nowrap',
    'text-shadow:0 0 20px currentColor',
  ].join(';')
  container.appendChild(el)

  let x  = Math.random() * (W - elW)
  let y  = Math.random() * (H - elH)
  let vx = 2.5 + Math.random() * 1.5
  let vy = 1.8 + Math.random() * 1.2
  let colorIdx = 0

  const tick = () => {
    x += vx; y += vy
    if (x <= 0 || x + elW >= W) {
      vx = -vx; x = Math.max(0, Math.min(W - elW, x))
      colorIdx = (colorIdx + 1) % COLORS.length
      el.style.color = COLORS[colorIdx]
    }
    if (y <= 0 || y + elH >= H) {
      vy = -vy; y = Math.max(0, Math.min(H - elH, y))
      colorIdx = (colorIdx + 1) % COLORS.length
      el.style.color = COLORS[colorIdx]
    }
    el.style.left = `${x}px`
    el.style.top  = `${y}px`
  }

  const ticker = gsap.ticker.add(tick)
  gsap.delayedCall(cfg.duration, () => {
    gsap.ticker.remove(ticker)
    gsap.to(el, {
      opacity: 0, duration: 0.3,
      onComplete: () => { el.remove(); gsap.set(container, { display: 'none' }) },
    })
  })
}
