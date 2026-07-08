import gsap from 'gsap'
import type { ChannelSweepConfig } from '@ieomlabs/shared'

/** CHANNEL-SWEEP — horizontal scan-line sweep, like changing a TV channel. */
export function runChannelSweep(cfg: ChannelSweepConfig): void {
  const staticEl = document.getElementById('tl-static-overlay')
  if (!staticEl) return

  gsap.timeline()
    .timeScale(Math.max(cfg?.speed ?? 1, 0.1))
    .set(staticEl, { opacity: 0, scaleY: 1 })
    .to(staticEl, { opacity: 1, duration: 0.08 })
    .to(staticEl, { scaleY: 0.04, duration: 0.12, ease: 'power3.in' })
    .to(staticEl, { scaleY: 1, duration: 0.12, ease: 'power3.out' })
    .to(staticEl, { opacity: 0, duration: 0.2 })
    .call(() => {
      gsap.set(staticEl, { clearProps: 'all' })
    })
}
