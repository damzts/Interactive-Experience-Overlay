import gsap from 'gsap'
import type { HypePulseConfig } from '@ieomlabs/shared'

const SPEED_DURATION = { slow: 3, normal: 1.5, fast: 0.7 }

let hypePulseStyleInjected = false

function injectStyle() {
  if (hypePulseStyleInjected) return
  hypePulseStyleInjected = true
  const s = document.createElement('style')
  s.textContent = `@keyframes hypePulseRainbow { 0%{filter:hue-rotate(0deg)} 100%{filter:hue-rotate(360deg)} }`
  document.head.appendChild(s)
}

/** HYPE-PULSE — rainbow neon border cycles around the screen for duration. */
export function runHypePulse(cfg: HypePulseConfig) {
  const container = document.getElementById('tl-hype-pulse')
  if (!container) return

  injectStyle()

  const cycleDur = SPEED_DURATION[cfg.speed ?? 'normal']
  const fade     = Math.min(cfg.duration * 0.15, 0.3)

  container.style.boxShadow = '0 0 50px #ff0080, inset 0 0 50px #ff0080'
  container.style.animation = `hypePulseRainbow ${cycleDur}s linear infinite`
  gsap.set(container, { display: 'block', opacity: 0 })

  gsap.timeline()
    .to(container, { opacity: 1, duration: fade })
    .to(container, { opacity: 0, duration: fade, delay: cfg.duration - fade * 2 })
    .call(() => {
      gsap.set(container, { display: 'none' })
      container.style.boxShadow = ''
      container.style.animation = ''
    })
}
