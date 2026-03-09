import gsap from 'gsap'

/** STATIC-BURST — TV static noise floods the screen, then clears. */
export function staticBurst(onComplete: () => void): gsap.core.Timeline {
  const overlay = document.getElementById('tl-static-overlay')
  const tl      = gsap.timeline()

  if (!overlay) { onComplete(); return tl }

  // Make sure static overlay is ready
  gsap.set(overlay, { display: 'block', opacity: 0 })

  tl
    // Burst in fast
    .to(overlay, { opacity: 1, duration: 0.12, ease: 'power3.in' })
    // Hold for a beat
    .to(overlay, { opacity: 1, duration: 0.25 })
    .call(onComplete)
    // Burst out
    .to(overlay, { opacity: 0, duration: 0.35, ease: 'power2.out' })
    .call(() => { gsap.set(overlay, { display: 'none', opacity: 0 }) })

  return tl
}
