import gsap from 'gsap'
import type { CrowdRoarConfig } from '@ieomlabs/shared'

/** CROWD-ROAR — heavy shake + red vignette flash + "CROWD GOES WILD" text. */
export function runCrowdRoar(cfg: CrowdRoarConfig) {
  const container = document.getElementById('tl-crowd-roar')
  const root      = document.getElementById('overlay-root')
  if (!container) return

  const text     = cfg.text ?? 'CROWD GOES WILD'
  const holdDur  = cfg.duration - 0.9

  gsap.set(container, { display: 'block' })
  container.innerHTML = ''

  const vignette = document.createElement('div')
  vignette.style.cssText = `position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 35%,rgba(220,0,0,0.75) 100%);opacity:0`

  const label = document.createElement('div')
  label.style.cssText = [
    'position:absolute', 'left:50%', 'top:50%',
    'transform:translate(-50%,-50%)',
    'font-family:VT323,monospace', 'font-size:80px',
    'color:#fff', 'letter-spacing:6px',
    'text-shadow:0 0 40px #ff0000, 0 0 20px #ff0000',
    'text-align:center', 'white-space:nowrap', 'opacity:0',
  ].join(';')
  label.textContent = text

  container.appendChild(vignette)
  container.appendChild(label)

  // Heavy screen shake
  if (root) {
    gsap.timeline()
      .to(root, { x: () => (Math.random() - 0.5) * 40, y: () => (Math.random() - 0.5) * 20, duration: 0.05, repeat: 12, yoyo: true, ease: 'none' })
      .set(root, { x: 0, y: 0 })
  }

  gsap.timeline()
    .to(vignette, { opacity: 1, duration: 0.15, ease: 'power3.in' })
    .to(label,    { opacity: 1, duration: 0.2, ease: 'power2.out' }, '<')
    .to(vignette, { opacity: 0.4, duration: 0.3 })
    .to(label,    { opacity: 0, duration: 0.35, ease: 'power2.in', delay: holdDur })
    .to(vignette, { opacity: 0, duration: 0.3 }, '<')
    .call(() => { container.innerHTML = ''; gsap.set(container, { display: 'none' }) })
}
