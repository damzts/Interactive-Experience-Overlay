import gsap from 'gsap'
import type { ScreentoneWipeConfig } from '@ieomlabs/shared'

/** SCREENTONE-WIPE — Manga halftone dot pattern wipes across screen, holds, wipes out. */
export function runScreentoneWipe(cfg: ScreentoneWipeConfig) {
  const container = document.getElementById('tl-screentone-wipe')
  if (!container) return

  const duration = cfg.duration ?? 2.5
  const opacity  = cfg.opacity  ?? 0.88
  const holdSec  = duration * 0.4

  gsap.set(container, { display: 'block' })
  container.innerHTML = ''

  // Two panels — wipe in from left, wipe out to right
  const panel = document.createElement('div')
  panel.style.cssText = [
    'position:absolute', 'inset:0',
    'background-color:#f5f5e8',
    'background-image:radial-gradient(circle,#111 1.5px,transparent 1.5px)',
    'background-size:8px 8px',
    `opacity:${opacity}`,
    'clip-path:inset(0 100% 0 0)',
  ].join(';')
  container.appendChild(panel)

  gsap.timeline()
    .to(panel, { clipPath: 'inset(0 0% 0 0)', duration: duration * 0.3, ease: 'power2.inOut' })
    .to(panel, { clipPath: 'inset(0 0% 0 100%)', duration: duration * 0.3, ease: 'power2.inOut', delay: holdSec })
    .to(panel, { opacity: 0, duration: 0.2 })
    .call(() => { container.innerHTML = ''; gsap.set(container, { display: 'none' }) })
}
