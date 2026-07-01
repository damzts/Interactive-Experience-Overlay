import gsap from 'gsap'
import type { NeonGlowConfig } from '@ieomlabs/shared'

const SIZE = { soft: 20, medium: 40, intense: 80 }

let rainbowStyleInjected = false

function injectRainbowStyle() {
  if (rainbowStyleInjected) return
  rainbowStyleInjected = true
  const s = document.createElement('style')
  s.textContent = `@keyframes neonRainbow { 0%{filter:hue-rotate(0deg)} 100%{filter:hue-rotate(360deg)} }`
  document.head.appendChild(s)
}

/** NEON-GLOW — pulsing neon border around the screen edges. */
export function runNeonGlow(cfg: NeonGlowConfig) {
  const container = document.getElementById('tl-neon-glow')
  if (!container) return

  const size  = SIZE[cfg.intensity]
  const color = cfg.color ?? '#00ffcc'
  const fade  = Math.min(cfg.duration * 0.2, 0.4)
  const hold  = cfg.duration - fade * 2

  if (cfg.rainbow) {
    injectRainbowStyle()
    container.style.animation = `neonRainbow ${cfg.duration}s linear infinite`
  } else {
    container.style.animation = ''
  }

  container.style.boxShadow = `0 0 ${size}px ${color}, inset 0 0 ${size}px ${color}`
  gsap.set(container, { display: 'block', opacity: 0 })

  gsap.timeline()
    .to(container, { opacity: 1, duration: fade, ease: 'power2.in' })
    .to(container, { opacity: 0, duration: fade, ease: 'power2.out', delay: hold })
    .call(() => {
      gsap.set(container, { display: 'none' })
      container.style.boxShadow = ''
      container.style.animation = ''
    })
}
