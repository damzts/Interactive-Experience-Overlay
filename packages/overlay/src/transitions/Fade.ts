import gsap from 'gsap'

/** FADE — cross-fade through black.  */
export function fadeTransition(onComplete: () => void): gsap.core.Timeline {
  const flash = document.getElementById('tl-flash')
  const tl    = gsap.timeline()

  if (!flash) { onComplete(); return tl }

  gsap.set(flash, { opacity: 0, backgroundColor: '#000000' })

  tl
    .to(flash, { opacity: 1, duration: 0.4, ease: 'power2.in' })
    .call(onComplete)
    .to(flash, { opacity: 0, duration: 0.4, ease: 'power2.out' })
    .call(() => { gsap.set(flash, { clearProps: 'all' }) })

  return tl
}
