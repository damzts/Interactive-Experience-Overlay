import gsap from 'gsap'

/** GAMEPLAY → LOBBY
 *  CRT static fills the screen, lobby content reveals underneath, static fades. */
export function gameplayToLobby(onComplete: () => void): gsap.core.Timeline {
  const tl = gsap.timeline()
  const staticEl = document.getElementById('tl-static-overlay')
  const flash = document.getElementById('tl-flash')

  if (!staticEl || !flash) {
    onComplete()
    return tl
  }

  tl.set(staticEl, { opacity: 0 })
    .to(staticEl, { opacity: 0.9, duration: 0.15 })
    .to(flash, { opacity: 0.4, duration: 0.05 })
    .to(flash, { opacity: 0, duration: 0.1 })
    // Lobby content is now ready under the static
    .call(onComplete)
    .to(staticEl, { opacity: 0, duration: 0.6, ease: 'power2.out' })
    .call(() => {
      gsap.set([staticEl, flash], { clearProps: 'all' })
    })

  return tl
}
