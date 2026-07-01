import gsap from 'gsap'
import type { MomentMarkerConfig } from '@ieomlabs/shared'

/** MOMENT-MARKER — "★ MOMENT" stamp glows in a corner then fades. */
export function runMomentMarker(cfg: MomentMarkerConfig) {
  const container = document.getElementById('tl-moment-marker')
  if (!container) return

  const color      = cfg.color     ?? '#f5c400'
  const label      = cfg.label     ?? '★ MOMENT'
  const durationMs = cfg.durationMs ?? 3500

  gsap.set(container, { display: 'block' })
  container.innerHTML = ''

  const badge = document.createElement('div')
  badge.style.cssText = [
    'display:inline-block',
    `background:rgba(0,0,0,0.8)`,
    `border:2px solid ${color}`,
    'padding:7px 16px',
    'font-family:VT323,monospace', 'font-size:22px',
    `color:${color}`,
    `text-shadow:0 0 12px ${color}`,
    `box-shadow:0 0 16px ${color}66`,
    'transform:scale(0)', 'opacity:0',
    'letter-spacing:3px',
  ].join(';')
  badge.textContent = label
  container.appendChild(badge)

  const dur = durationMs / 1000
  gsap.timeline()
    .to(badge, { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(1.8)' })
    .to(badge, { boxShadow: `0 0 28px ${color}`, duration: 0.4, yoyo: true, repeat: 2, ease: 'sine.inOut' })
    .to(badge, { opacity: 0, scale: 0.85, duration: 0.3, ease: 'power2.in', delay: dur - 1.1 })
    .call(() => { container.innerHTML = ''; gsap.set(container, { display: 'none' }) })
}
