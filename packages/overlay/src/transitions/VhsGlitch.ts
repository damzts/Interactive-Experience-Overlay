import gsap from 'gsap'
import type { VhsGlitchConfig } from '@ieomlabs/shared'

const INTENSITY_MAP = {
  subtle:   { offset: 5,  scanCount: 2, alpha: 0.12 },
  moderate: { offset: 12, scanCount: 4, alpha: 0.22 },
  extreme:  { offset: 24, scanCount: 8, alpha: 0.40 },
}

let styleInjected = false

function injectStyle() {
  if (styleInjected) return
  styleInjected = true
  const s = document.createElement('style')
  s.textContent = `
    @keyframes vhsScan {
      0%   { transform: translateY(-100%) }
      100% { transform: translateY(100vh)  }
    }
  `
  document.head.appendChild(s)
}

/** VHS-GLITCH — VHS tape tracking artifacts with RGB displacement and scanlines. */
export function runVhsGlitch(cfg: VhsGlitchConfig) {
  const container = document.getElementById('tl-vhs-glitch')
  if (!container) return

  injectStyle()

  const { offset, scanCount, alpha } = INTENSITY_MAP[cfg.intensity]

  gsap.set(container, { display: 'block', opacity: 0 })
  container.innerHTML = ''

  // RGB channel splits
  const red = document.createElement('div')
  red.style.cssText  = `position:absolute;inset:0;background:rgba(255,0,0,${alpha});mix-blend-mode:screen;transform:translateX(${offset}px)`
  const blue = document.createElement('div')
  blue.style.cssText = `position:absolute;inset:0;background:rgba(0,0,255,${alpha});mix-blend-mode:screen;transform:translateX(-${offset}px)`
  container.appendChild(red)
  container.appendChild(blue)

  // Horizontal scan bands
  for (let i = 0; i < scanCount; i++) {
    const scan = document.createElement('div')
    const h    = 2 + Math.random() * 5
    const dur  = 0.35 + Math.random() * 0.25
    scan.style.cssText = [
      'position:absolute', 'left:0', 'width:100%', `height:${h}px`,
      `top:${Math.random() * 80}%`,
      `background:rgba(255,255,255,${0.15 + Math.random() * alpha})`,
      `animation:vhsScan ${dur}s linear infinite`,
    ].join(';')
    container.appendChild(scan)
  }

  const fade = Math.min(cfg.duration * 0.15, 0.25)
  gsap.timeline()
    .to(container, { opacity: 1, duration: fade })
    .to(container, { opacity: 0, duration: fade, delay: cfg.duration - fade * 2 })
    .call(() => { gsap.set(container, { display: 'none' }); container.innerHTML = '' })
}
