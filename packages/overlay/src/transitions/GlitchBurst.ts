import gsap from 'gsap'
import type { GlitchBurstTransitionConfig } from '@ieomlabs/shared'

/** GLITCH-BURST — rapid chromatic shift flashes, then cuts. */
export function runGlitchBurst(cfg: GlitchBurstTransitionConfig): void {
  const root = document.getElementById('overlay-root')
  const flash = document.getElementById('tl-flash')
  if (!flash || !root) return

  gsap.set(flash, { opacity: 0, backgroundColor: '#ff00ff' })

  const tl = gsap.timeline().timeScale(Math.max(cfg?.speed ?? 1, 0.1))

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

  // Spike 3 — full white-out cut
  tl.to(flash, { opacity: 1, duration: 0.03, ease: 'none' })
  tl.to(flash, { opacity: 0, duration: 0.25, ease: 'power2.out' })
  tl.call(() => {
    gsap.set(flash, { clearProps: 'all' })
    gsap.set(root, { clearProps: 'filter,x' })
  })
}
