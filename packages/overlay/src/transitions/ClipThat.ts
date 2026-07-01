import gsap from 'gsap'
import type { ClipThatConfig } from '@ieomlabs/shared'

/** CLIP-THAT — "✂ CLIP IT" badge pulses in corner with glow ring. */
export function runClipThat(cfg: ClipThatConfig) {
  const container = document.getElementById('tl-clip-that')
  if (!container) return

  const color      = cfg.color ?? '#ff4444'
  const durationMs = cfg.durationMs ?? 3000

  gsap.set(container, { display: 'block' })
  container.innerHTML = ''

  const badge = document.createElement('div')
  badge.style.cssText = [
    'display:inline-flex', 'align-items:center', 'gap:8px',
    `background:rgba(0,0,0,0.85)`,
    `border:2px solid ${color}`,
    'padding:8px 16px',
    'font-family:VT323,monospace', 'font-size:26px',
    `color:${color}`,
    `box-shadow:0 0 20px ${color}88`,
    'transform:scale(0)', 'opacity:0',
  ].join(';')
  badge.innerHTML = `<span>✂</span> <span>CLIP IT</span>`
  container.appendChild(badge)

  const dur = durationMs / 1000
  gsap.timeline()
    .to(badge, { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(2)' })
    .to(badge, { scale: 1.06, duration: 0.15, yoyo: true, repeat: 3, ease: 'sine.inOut' })
    .to(badge, { opacity: 0, scale: 0.8, duration: 0.3, ease: 'power2.in', delay: dur - 0.9 })
    .call(() => { container.innerHTML = ''; gsap.set(container, { display: 'none' }) })
}
