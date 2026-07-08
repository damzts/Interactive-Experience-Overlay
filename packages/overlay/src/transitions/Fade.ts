import gsap from 'gsap'
import type { FadeTransitionConfig } from '@ieomlabs/shared'

/** FADE — cross-fade through black. */
export function runFadeTransition(cfg: FadeTransitionConfig): void {
  const flash = document.getElementById('tl-flash')
  if (!flash) return

  gsap.set(flash, { opacity: 0, backgroundColor: '#000000' })

  gsap.timeline()
    .timeScale(Math.max(cfg?.speed ?? 1, 0.1))
    .to(flash, { opacity: 1, duration: 0.4, ease: 'power2.in' })
    .to(flash, { opacity: 0, duration: 0.4, ease: 'power2.out' })
    .call(() => { gsap.set(flash, { clearProps: 'all' }) })
}
