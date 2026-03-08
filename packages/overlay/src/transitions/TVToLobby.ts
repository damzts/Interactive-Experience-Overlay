import gsap from 'gsap'

/** TV → LOBBY
 *  Same channel-change sweep in reverse. */
export function tvToLobby(onComplete: () => void): gsap.core.Timeline {
  const tl = gsap.timeline()
  const staticEl = document.getElementById('tl-static-overlay')

  if (!staticEl) {
    onComplete()
    return tl
  }

  tl.set(staticEl, { opacity: 0, scaleY: 1 })
    .to(staticEl, { opacity: 1, duration: 0.08 })
    .to(staticEl, { scaleY: 0.04, duration: 0.12, ease: 'power3.in' })
    .call(onComplete)
    .to(staticEl, { scaleY: 1, duration: 0.12, ease: 'power3.out' })
    .to(staticEl, { opacity: 0, duration: 0.2 })
    .call(() => {
      gsap.set(staticEl, { clearProps: 'all' })
    })

  return tl
}
