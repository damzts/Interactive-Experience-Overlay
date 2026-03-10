import gsap from 'gsap'
import type { StaticBurstConfig } from '@ieom/shared'

/** STATIC-BURST — TV static noise floods the screen then clears.
 *  Config-aware wrapper around the existing #tl-static-overlay element. */
export function runStaticBurst(cfg: StaticBurstConfig) {
  const overlay = document.getElementById('tl-static-overlay')
  if (!overlay) return

  const fadeDur = Math.min(cfg.duration * 0.25, 0.3)
  const holdDur = cfg.duration - fadeDur * 2

  gsap.set(overlay, { display: 'block', opacity: 0 })

  gsap.timeline()
    .to(overlay, { opacity: cfg.opacity, duration: fadeDur, ease: 'power3.in' })
    .to(overlay, { opacity: cfg.opacity, duration: holdDur })
    .to(overlay, { opacity: 0, duration: fadeDur, ease: 'power2.out' })
    .call(() => { gsap.set(overlay, { display: 'none', opacity: 0 }) })
}
