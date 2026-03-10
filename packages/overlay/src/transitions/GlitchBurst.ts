import gsap from 'gsap'

/** GLITCH-BURST — rapid chromatic shift flashes, then cuts. */
export function glitchBurst(onComplete: () => void): gsap.core.Timeline {
  const root = document.getElementById('overlay-root')
  const flash = document.getElementById('tl-flash')
  const tl    = gsap.timeline()

  if (!flash || !root) { onComplete(); return tl }

  gsap.set(flash, { opacity: 0, backgroundColor: '#ff00ff' })

  // Spike 1 — cyan
  tl.to(flash, { opacity: 0.7, duration: 0.04, ease: 'none' })
  tl.to(flash, { opacity: 0, duration: 0.04, ease: 'none' })
  // Quick filter glitch on overlay root
  tl.to(root, { filter: 'hue-rotate(120deg) saturate(4)', duration: 0.05, ease: 'none' }, '<')
  tl.to(root, { filter: 'none', duration: 0.05, ease: 'none' })

  // Spike 2 — white
  tl.set(flash, { backgroundColor: '#ffffff' })
  tl.to(flash, { opacity: 0.9, duration: 0.05, ease: 'none' })
  tl.to(root, { x: 8, duration: 0.04, ease: 'none' }, '<')
  tl.to(root, { x: -6, duration: 0.04, ease: 'none' })
  tl.to(root, { x: 0, duration: 0.04, ease: 'none' })
  tl.to(flash, { opacity: 0, duration: 0.05, ease: 'none' })

  // Spike 3 — full white-out for cut
  tl.to(flash, { opacity: 1, duration: 0.03, ease: 'none' })
  tl.call(onComplete)
  tl.to(flash, { opacity: 0, duration: 0.25, ease: 'power2.out' })
  tl.call(() => {
    gsap.set(flash, { clearProps: 'all' })
    gsap.set(root, { clearProps: 'filter,x' })
  })

  return tl
}
