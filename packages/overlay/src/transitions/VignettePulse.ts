import gsap from 'gsap'
import type { VignettePulseConfig } from '@ieomlabs/shared'

/** VIGNETTE-PULSE — floods the screen with a color vignette, optional centered text. */
export function runVignettePulse(cfg: VignettePulseConfig) {
  const overlay = document.getElementById('tl-vignette-overlay')
  if (!overlay) return

  // Set color via CSS variable or inline style on the radial gradient
  overlay.style.background = `radial-gradient(ellipse at center, transparent 40%, ${cfg.color} 100%)`
  overlay.style.opacity = '0'

  // Optional text element
  let textEl = overlay.querySelector<HTMLElement>('.vignette-text')
  if (cfg.text) {
    if (!textEl) {
      textEl = document.createElement('div')
      textEl.className = 'vignette-text'
      textEl.style.cssText = [
        'position:absolute', 'left:50%', 'top:50%',
        'transform:translate(-50%,-50%)',
        'font-family:VT323,monospace',
        'font-size:64px',
        'color:#fff',
        'text-shadow:0 0 30px currentColor',
        'letter-spacing:8px',
        'text-align:center',
        'pointer-events:none',
        'white-space:nowrap',
      ].join(';')
      overlay.appendChild(textEl)
    }
    textEl.textContent = cfg.text
    textEl.style.color = cfg.color
    textEl.style.textShadow = `0 0 30px ${cfg.color}`
  } else {
    textEl?.remove()
  }

  const holdTime = cfg.duration * 0.4
  const fadeTime = cfg.duration * 0.3

  gsap.timeline()
    .to(overlay, { opacity: cfg.opacity, duration: fadeTime, ease: 'power2.in' })
    .to(overlay, { opacity: 0, duration: fadeTime, ease: 'power2.out', delay: holdTime })
    .call(() => {
      overlay.style.background = ''
      textEl?.remove()
    })
}
