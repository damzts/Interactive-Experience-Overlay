import gsap from 'gsap'
import type { CriticalHitConfig } from '@ieomlabs/shared'

/** CRITICAL-HIT — full-screen flash + slamming impact text. */
export function runCriticalHit(cfg: CriticalHitConfig) {
  const container = document.getElementById('tl-critical-hit')
  if (!container) return

  const text  = cfg.text  ?? 'CRITICAL HIT!'
  const color = cfg.color ?? '#ff2222'
  const durMs = cfg.durationMs ?? 900

  gsap.set(container, { display: 'block' })
  container.innerHTML = `
    <div id="tl-crit-flash" style="position:absolute;inset:0;background:${color};opacity:0"></div>
    <div id="tl-crit-text" style="
      position:absolute; left:50%; top:50%; transform:translate(-50%,-50%) scale(2.6) rotate(-4deg);
      font-family:VT323,monospace; font-size:96px; font-weight:bold; color:#fff;
      -webkit-text-stroke:3px ${color}; text-shadow:0 0 30px ${color}; opacity:0; white-space:nowrap;
    ">${text}</div>
  `

  const flash = container.querySelector('#tl-crit-flash')
  const txt   = container.querySelector('#tl-crit-text')

  gsap.timeline()
    .to(flash, { opacity: 0.55, duration: 0.06 })
    .to(flash, { opacity: 0, duration: 0.25 })
    .to(txt,   { opacity: 1, scale: 1, rotate: -2, duration: 0.18, ease: 'power4.out' }, 0)
    .to(txt,   { opacity: 0, duration: 0.2, delay: Math.max(durMs / 1000 - 0.5, 0.15) })
    .call(() => { container.innerHTML = ''; gsap.set(container, { display: 'none' }) })
}
