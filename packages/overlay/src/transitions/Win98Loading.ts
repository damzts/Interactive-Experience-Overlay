import gsap from 'gsap'
import type { Win98LoadingConfig } from '@ieomlabs/shared'

/** WIN98-LOADING — a fake Win98 "Loading…" dialog with a progress bar,
 *  flashes white at the end, then fades out. */
export function runWin98Loading(cfg: Win98LoadingConfig): void {
  const loadWin = document.getElementById('tl-loading-window')
  const progressBar = document.getElementById('tl-progress-bar')
  const flash = document.getElementById('tl-flash')
  if (!loadWin || !progressBar || !flash) return

  gsap.timeline()
    .timeScale(Math.max(cfg?.speed ?? 1, 0.1))
    .set(loadWin, { opacity: 0 })
    .to(loadWin, { opacity: 1, duration: 0.3, ease: 'power2.out' })
    .to(progressBar, { width: '100%', duration: 2.2, ease: 'power1.inOut' })
    .to(flash, { opacity: 1, duration: 0.06 })
    .to(flash, { opacity: 0, duration: 0.4, delay: 0.15 })
    .to(loadWin, { opacity: 0, duration: 0.3 })
    .call(() => {
      gsap.set([loadWin, flash], { clearProps: 'all' })
      gsap.set(progressBar, { clearProps: 'all' })
    })
}
