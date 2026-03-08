import gsap from 'gsap'

/** NETWORK_GLITCH overlay — screen shake + broadcast interruption message.
 *  Plays on top of current scene, no state change. Auto-clears after ~2s. */
export function runNetworkGlitch() {
  const root    = document.getElementById('overlay-root')
  const overlay = document.getElementById('tl-glitch-overlay')
  const msg     = document.getElementById('tl-glitch-message')

  if (!overlay || !msg) return

  const tl = gsap.timeline()

  // Screen shake on the root element
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

  tl.set(overlay, { opacity: 0 })
    .set(msg, { opacity: 0, x: -10 })
    .to(overlay, { opacity: 1, duration: 0.1 }, root ? '-=0.15' : 0)
    .to(msg, { opacity: 1, x: 0, duration: 0.15 })
    .to(msg, { opacity: 0.7, duration: 0.1, delay: 0.8 })
    .to([overlay, msg], { opacity: 0, duration: 0.4 })
    .call(() => {
      gsap.set([overlay, msg], { clearProps: 'all' })
    })
}
