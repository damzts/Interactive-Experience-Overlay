import gsap from 'gsap'
import type { CrtWipeConfig } from '@ieomlabs/shared'

/** CRT-WIPE — CRT static floods the screen, briefly flashes, then fades out
 *  to reveal whatever's underneath. */
export function runCrtWipe(cfg: CrtWipeConfig): void {
  const staticEl = document.getElementById('tl-static-overlay')
  const flash = document.getElementById('tl-flash')
  if (!staticEl || !flash) return

  gsap.timeline()
    .timeScale(Math.max(cfg?.speed ?? 1, 0.1))
    .set(staticEl, { opacity: 0 })
    .to(staticEl, { opacity: 0.9, duration: 0.15 })
    .to(flash, { opacity: 0.4, duration: 0.05 })
    .to(flash, { opacity: 0, duration: 0.1 })
    .to(staticEl, { opacity: 0, duration: 0.6, ease: 'power2.out' })
    .call(() => {
      gsap.set([staticEl, flash], { clearProps: 'all' })
    })
}
