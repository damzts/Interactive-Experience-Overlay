import gsap from 'gsap'
import type { ScreenShakeConfig } from '@ieomlabs/shared'

const INTENSITY = {
  light:  { x: 6,  y: 4,  repeat: 4 },
  medium: { x: 14, y: 8,  repeat: 6 },
  heavy:  { x: 26, y: 14, repeat: 10 },
}

/** SCREEN-SHAKE — camera shake on the root element only, no visual overlay. */
export function runScreenShake(cfg: ScreenShakeConfig) {
  const root = document.getElementById('overlay-root')
  if (!root) return

  const { x, y, repeat } = INTENSITY[cfg.intensity]
  const singleDuration = cfg.duration / (repeat * 2)

  gsap.timeline()
    .to(root, {
      x: () => (Math.random() - 0.5) * x * 2,
      y: () => (Math.random() - 0.5) * y * 2,
      duration: singleDuration,
      repeat,
      yoyo: true,
      ease: 'none',
    })
    .set(root, { x: 0, y: 0 })
}
