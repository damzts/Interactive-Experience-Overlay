import gsap from 'gsap'

/** DESKTOP → LOBBY
 *  Glitch flash → desktop layer scales down (zoom-out) → fade to black → lobby appears.
 *  The inverse bookend of lobby-to-desktop. */
export function desktopToLobby(onComplete: () => void): gsap.core.Timeline {
  const desktopLayer = document.getElementById('desktop-layer')
  const flash        = document.getElementById('tl-flash')
  const tl           = gsap.timeline()

  if (!desktopLayer || !flash) {
    onComplete()
    return tl
  }

  gsap.set(desktopLayer, { scale: 1, transformOrigin: '50% 50%' })
  gsap.set(flash, { opacity: 0, backgroundColor: '#000000' })

  tl
    // ── Quick glitch flash to punctuate the exit ──────────────────────────
    .to(flash, { opacity: 0.6, duration: 0.05, ease: 'none' })
    .to(flash, { opacity: 0,   duration: 0.05, ease: 'none' })
    .to(flash, { opacity: 0.9, duration: 0.04, ease: 'none' })
    // ── Zoom the desktop out, as if pulling away from the PC screen ───────
    .to(desktopLayer, { scale: 0.08, duration: 0.55, ease: 'power3.in' }, '-=0.04')
    // ── Fade to black over the cut ────────────────────────────────────────
    .to(flash, { opacity: 1, duration: 0.15, ease: 'power2.in' }, '-=0.15')
    // ── Complete → server resolves state to LOBBY ─────────────────────────
    .call(onComplete)
    // ── Fade out the black so lobby becomes visible ───────────────────────
    .to(flash, { opacity: 0, duration: 0.4, ease: 'power2.out' })
    // ── Reset desktop layer ───────────────────────────────────────────────
    .call(() => {
      gsap.set(desktopLayer, { clearProps: 'all' })
      gsap.set(flash, { clearProps: 'all' })
    })

  return tl
}
