import gsap from 'gsap'
import type { NetworkGlitchConfig } from '@ieomlabs/shared'

/** NETWORK_GLITCH overlay — screen shake + broadcast interruption message. */
export function runNetworkGlitch(cfg?: NetworkGlitchConfig) {
  const root    = document.getElementById('overlay-root')
  const overlay = document.getElementById('tl-glitch-overlay')
  const msg     = document.getElementById('tl-glitch-message')

  if (!overlay || !msg) return

  // Apply custom message if provided
  const message = cfg?.message ?? '[ NETWORK INTERRUPTION ]'
  const dur     = cfg?.duration ?? 2
  const firstLine = msg.firstChild
  if (firstLine) firstLine.textContent = message

  const tl = gsap.timeline()

  if (root) {
    tl.to(root, {
      x: () => (Math.random() - 0.5) * 18,
      y: () => (Math.random() - 0.5) * 10,
      duration: 0.06,
      repeat: 6,
      yoyo: true,
      ease: 'none',
    })
    .set(root, { x: 0, y: 0 })
  }

  const holdDur = Math.max(dur - 0.75, 0.2)

  tl.set(overlay, { opacity: 0 })
    .set(msg, { opacity: 0, x: -10 })
    .to(overlay, { opacity: 1, duration: 0.1 }, root ? '-=0.15' : 0)
    .to(msg, { opacity: 1, x: 0, duration: 0.15 })
    .to(msg, { opacity: 0.7, duration: 0.1, delay: holdDur })
    .to([overlay, msg], { opacity: 0, duration: 0.4 })
    .call(() => {
      gsap.set([overlay, msg], { clearProps: 'all' })
      // Restore message text for built-in usage
      if (firstLine) firstLine.textContent = '[ NETWORK INTERRUPTION ]'
    })
}
