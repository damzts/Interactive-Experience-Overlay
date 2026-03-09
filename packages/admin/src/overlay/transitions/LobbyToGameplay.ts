import gsap from 'gsap'

/** LOBBY → GAMEPLAY
 *  Shows a fake Win98 "Loading game…" dialog with a progress bar.
 *  Screen flashes white while state switches underneath, then reveals gameplay. */
export function lobbyToGameplay(onComplete: () => void): gsap.core.Timeline {
  const tl = gsap.timeline()
  const loadWin = document.getElementById('tl-loading-window')
  const progressBar = document.getElementById('tl-progress-bar')
  const flash = document.getElementById('tl-flash')

  if (!loadWin || !progressBar || !flash) {
    onComplete()
    return tl
  }

  tl.set(loadWin, { opacity: 0 })
    .to(loadWin, { opacity: 1, duration: 0.3, ease: 'power2.out' })
    .to(progressBar, { width: '100%', duration: 2.2, ease: 'power1.inOut' })
    .to(flash, { opacity: 1, duration: 0.06 })
    // State switches while screen is fully white
    .call(onComplete)
    .to(flash, { opacity: 0, duration: 0.4, delay: 0.15 })
    .to(loadWin, { opacity: 0, duration: 0.3 })
    .call(() => {
      gsap.set([loadWin, flash], { clearProps: 'all' })
      gsap.set(progressBar, { clearProps: 'all' })
    })

  return tl
}
