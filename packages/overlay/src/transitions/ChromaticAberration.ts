import gsap from 'gsap'
import type { ChromaticAberrationConfig } from '@ieomlabs/shared'

const OFFSET = { subtle: 4, moderate: 12, extreme: 26 }

/** CHROMATIC-ABERRATION — RGB channel offset on overlapping color tinted clones. */
export function runChromaticAberration(cfg: ChromaticAberrationConfig) {
  const container = document.getElementById('tl-chromatic')
  if (!container) return

  const off = OFFSET[cfg.intensity]
  gsap.set(container, { display: 'block', opacity: 0 })
  container.innerHTML = ''

  const red = document.createElement('div')
  red.style.cssText   = `position:absolute;inset:0;background:radial-gradient(ellipse at 30% 50%,rgba(255,0,0,0.22),transparent 65%);mix-blend-mode:screen;transform:translateX(${off}px)`
  const blue = document.createElement('div')
  blue.style.cssText  = `position:absolute;inset:0;background:radial-gradient(ellipse at 70% 50%,rgba(0,80,255,0.22),transparent 65%);mix-blend-mode:screen;transform:translateX(-${off}px)`
  const green = document.createElement('div')
  green.style.cssText = `position:absolute;inset:0;background:radial-gradient(ellipse at 50% 30%,rgba(0,220,80,0.1),transparent 65%);mix-blend-mode:screen;transform:translateY(-${Math.floor(off / 2)}px)`

  container.appendChild(red)
  container.appendChild(blue)
  container.appendChild(green)

  const fade = Math.min(cfg.duration * 0.18, 0.28)
  const hold = cfg.duration - fade * 2

  gsap.timeline()
    .to(container, { opacity: 1, duration: fade })
    .to(container, { opacity: 0, duration: fade, delay: hold })
    .call(() => { gsap.set(container, { display: 'none' }); container.innerHTML = '' })
}
