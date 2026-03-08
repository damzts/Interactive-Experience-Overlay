import gsap from 'gsap'
import { playBootSequence } from './BootSequence'

/** LOBBY → DESKTOP
 *  Pure CSS optical illusion: GSAP scales the #lobby-layer div outward from
 *  the monitor position, making it look like the camera rushes into the screen.
 *  A white flash fires at peak zoom and covers the cut while the Desktop
 *  mounts underneath – no 3D/2D coupling needed. */
export function lobbyToDesktop(onComplete: () => void): gsap.core.Timeline {
  const lobbyLayer = document.getElementById('lobby-layer')
  const flash      = document.getElementById('tl-flash')
  const tl         = gsap.timeline()

  if (!lobbyLayer || !flash) {
    onComplete()
    return tl
  }

  // Make sure transform starts clean
  gsap.set(lobbyLayer, { scale: 1, transformOrigin: '50% 55%' })

  tl
    // ── Rush into the monitor screen ─────────────────────────────────────
    .to(lobbyLayer, {
      scale: 18,
      duration: 1.45,
      ease: 'power3.in',
      // transformOrigin stays fixed so scale anchors to monitor position
    })
    // ── White-out flash hides the hard cut ───────────────────────────────
    .to(flash, { opacity: 1, duration: 0.06, ease: 'none' })
    // ── Desktop is loaded — now play boot sequence, THEN tell server done ───
    .call(() => {
      playBootSequence(onComplete)
    })
    // ── Fade flash over the boot screen (boot screen is now showing) ─────
    .to(flash, { opacity: 0, duration: 0.3, delay: 0.05, ease: 'power2.out' })
    // ── Reset lobby layer so it's ready for next time ─────────────────────
    .call(() => {
      gsap.set(lobbyLayer, { clearProps: 'all' })
      gsap.set(flash, { clearProps: 'all' })
    })

  return tl
}
