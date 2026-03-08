import gsap from 'gsap'

/** REVIVE overlay — "Restarting process..." boot sequence.
 *  Plays on top of current scene, no state change. Auto-clears after ~3s. */
export function runReviveOverlay() {
  const overlay = document.getElementById('tl-revive-overlay')
  const line1   = document.getElementById('tl-revive-line1')
  const line2   = document.getElementById('tl-revive-line2')
  const bar     = document.getElementById('tl-revive-bar-fill')

  if (!overlay || !line1 || !line2 || !bar) return

  const tl = gsap.timeline()

  tl.set(overlay, { opacity: 0 })
    .set([line1, line2], { opacity: 0 })
    .set(bar, { width: '0%' })
    .to(overlay, { opacity: 1, duration: 0.2 })
    .to(line1, { opacity: 1, duration: 0.1 }, '+=0.1')
    .to(bar, { width: '100%', duration: 1.2, ease: 'power1.inOut' }, '+=0.1')
    .to(line2, { opacity: 1, duration: 0.1 }, '-=0.4')
    .to(overlay, { opacity: 0, duration: 0.5, ease: 'power2.in', delay: 0.6 })
    .call(() => {
      gsap.set([overlay, line1, line2, bar], { clearProps: 'all' })
    })
}
