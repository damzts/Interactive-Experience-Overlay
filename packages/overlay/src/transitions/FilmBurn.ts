import gsap from 'gsap'
import type { FilmBurnConfig } from '@ieomlabs/shared'

const CORNER_GRADIENT: Record<FilmBurnConfig['corner'], string> = {
  tl: 'radial-gradient(ellipse at 0% 0%,   #ffcc88 0%, rgba(255,110,20,0.7) 35%, transparent 70%)',
  tr: 'radial-gradient(ellipse at 100% 0%,  #ffcc88 0%, rgba(255,110,20,0.7) 35%, transparent 70%)',
  bl: 'radial-gradient(ellipse at 0% 100%,  #ffcc88 0%, rgba(255,110,20,0.7) 35%, transparent 70%)',
  br: 'radial-gradient(ellipse at 100% 100%,#ffcc88 0%, rgba(255,110,20,0.7) 35%, transparent 70%)',
}

/** FILM-BURN — warm overexposure wash blooms from a screen corner. */
export function runFilmBurn(cfg: FilmBurnConfig) {
  const container = document.getElementById('tl-film-burn')
  if (!container) return

  gsap.set(container, { display: 'block', opacity: 0 })
  container.innerHTML = ''

  const burn = document.createElement('div')
  burn.style.cssText = `position:absolute;inset:0;background:${CORNER_GRADIENT[cfg.corner]};mix-blend-mode:screen`
  container.appendChild(burn)

  const fade = Math.min(cfg.duration * 0.25, 0.4)
  const hold = cfg.duration - fade * 2

  gsap.timeline()
    .to(container, { opacity: 1, duration: fade, ease: 'power3.in' })
    .to(container, { opacity: 0, duration: fade, ease: 'power2.out', delay: hold })
    .call(() => { gsap.set(container, { display: 'none' }); burn.remove() })
}
