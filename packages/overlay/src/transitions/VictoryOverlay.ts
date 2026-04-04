import gsap from 'gsap'
import type { VictoryOverlayConfig } from '@ieom/shared'

/** VICTORY overlay — MISSION.LOG saved window + success flash.
 *  Plays on top of current scene, no state change. Auto-clears after ~3s. */
export function runVictoryOverlay(cfg?: VictoryOverlayConfig) {
  const overlay = document.getElementById('tl-victory-overlay')
  const title   = document.getElementById('tl-victory-title')
  const body    = document.getElementById('tl-victory-body')
  const speed = Math.max(cfg?.speed ?? 1, 0.1)

  if (!overlay || !title || !body) return

  const tl = gsap.timeline()
  tl.timeScale(speed)

  tl.set(overlay, { opacity: 0, scale: 0.85, y: 40 })
    .to(overlay, { opacity: 1, scale: 1, y: 0, duration: 0.35, ease: 'back.out(1.4)' })
    .fromTo(
      title,
      { opacity: 0 },
      { opacity: 1, duration: 0.2 },
      '+=0.05',
    )
    .fromTo(
      body,
      { opacity: 0, y: 8 },
      { opacity: 1, y: 0, duration: 0.3 },
      '-=0.1',
    )
    .to(overlay, { opacity: 0, scale: 0.95, y: -20, duration: 0.5, ease: 'power2.in', delay: 2 })
    .call(() => {
      gsap.set([overlay, title, body], { clearProps: 'all' })
    })
}
