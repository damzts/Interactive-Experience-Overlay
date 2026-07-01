import gsap from 'gsap'
import type { ScanLinesSweepConfig } from '@ieomlabs/shared'

/** SCAN-LINES-SWEEP — a CRT scanline gradient sweeps from top to bottom. */
export function runScanLinesSweep(cfg: ScanLinesSweepConfig) {
  const container = document.getElementById('tl-scan-lines')
  if (!container) return

  const color   = cfg.color   ?? '#ffffff'
  const opacity = cfg.opacity ?? 0.15

  gsap.set(container, { display: 'block' })
  container.innerHTML = ''

  const stripe = document.createElement('div')
  stripe.style.cssText = [
    'position:absolute', 'left:0', 'width:100%', 'height:140px',
    `background:linear-gradient(180deg,transparent 0%,${color} 50%,transparent 100%)`,
    `opacity:${opacity}`,
    'top:-140px',
  ].join(';')
  container.appendChild(stripe)

  gsap.timeline()
    .to(stripe, { top: '110%', duration: cfg.duration, ease: 'power1.inOut' })
    .call(() => { gsap.set(container, { display: 'none' }); container.innerHTML = '' })
}
