import gsap from 'gsap'
import type { WipeRightConfig } from '@ieomlabs/shared'

/** WIPE-RIGHT — a black panel sweeps in from the left, cuts, then exits right. */
export function runWipeRight(cfg: WipeRightConfig): void {
  const flash = document.getElementById('tl-flash')
  if (!flash) return

  gsap.set(flash, {
    opacity: 1,
    backgroundColor: '#000000',
    clipPath: 'inset(0 0% 0 100%)',
  })

  gsap.timeline()
    .timeScale(Math.max(cfg?.speed ?? 1, 0.1))
    .to(flash, { clipPath: 'inset(0 0% 0 0%)', duration: 0.45, ease: 'power2.inOut' })
    .to(flash, { clipPath: 'inset(0 100% 0 0%)', duration: 0.45, ease: 'power2.inOut' })
    .call(() => { gsap.set(flash, { clearProps: 'all' }) })
}
