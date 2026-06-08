import gsap from 'gsap'
import type { DeathOverlayConfig } from '@ieomlabs/shared'

/** Runs the DEATH overlay animation — red vignette + YOU DIED text.
 *  Not a state transition; called directly from useSocket on overlay:show event.
 *  Auto-clears after 3 seconds. */
export function runDeathOverlay(cfg?: DeathOverlayConfig) {
  const overlay = document.getElementById('tl-death-overlay')
  const text = document.getElementById('tl-death-text')
  const speed = Math.max(cfg?.speed ?? 1, 0.1)

  if (!overlay || !text) return

  const tl = gsap.timeline()
  tl.timeScale(speed)

  tl.set(overlay, { opacity: 0 })
    .set(text, { opacity: 0, scale: 1.4 })
    .to(overlay, { opacity: 1, duration: 0.3 })
    .to(text, { opacity: 1, scale: 1, duration: 0.5, ease: 'power3.out' })
    .to(overlay, { opacity: 0.7, duration: 0.3, delay: 1.5 })
    .to([overlay, text], { opacity: 0, duration: 0.8 })
    .call(() => {
      gsap.set([overlay, text], { clearProps: 'all' })
    })
}
