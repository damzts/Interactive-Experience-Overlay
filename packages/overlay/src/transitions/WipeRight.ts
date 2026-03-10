import gsap from 'gsap'

/** WIPE-RIGHT — a black panel sweeps in from the left, cuts, then exits right. */
export function wipeRight(onComplete: () => void): gsap.core.Timeline {
  const flash = document.getElementById('tl-flash')
  const tl    = gsap.timeline()

  if (!flash) { onComplete(); return tl }

  gsap.set(flash, {
    opacity: 1,
    backgroundColor: '#000000',
    clipPath: 'inset(0 0% 0 100%)',
  })

  tl
    // Wipe panel in from left
    .to(flash, { clipPath: 'inset(0 0% 0 0%)', duration: 0.45, ease: 'power2.inOut' })
    .call(onComplete)
    // Wipe panel out to right
    .to(flash, { clipPath: 'inset(0 100% 0 0%)', duration: 0.45, ease: 'power2.inOut' })
    .call(() => { gsap.set(flash, { clearProps: 'all' }) })

  return tl
}
