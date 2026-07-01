import gsap from 'gsap'
import type { XpBalloonConfig } from '@ieomlabs/shared'

/** XP-BALLOON — Windows XP system tray balloon notification. */
export function runXpBalloon(cfg: XpBalloonConfig) {
  const container = document.getElementById('tl-xp-balloon')
  if (!container) return

  const title    = cfg.title    ?? 'Windows has found new hardware'
  const body     = cfg.body     ?? 'Click here to install the drivers.'
  const holdSec  = (cfg.durationMs ?? 4000) / 1000 - 0.6

  gsap.set(container, { display: 'block' })
  container.innerHTML = ''

  const balloon = document.createElement('div')
  balloon.style.cssText = [
    'width:260px',
    'background:#fffacd',
    'border:1px solid #c8a000',
    'border-radius:8px 8px 0 8px',
    'box-shadow:1px 3px 8px rgba(0,0,0,0.35)',
    'font-family:"Tahoma",Arial,sans-serif',
    'overflow:hidden',
    'opacity:0',
    'transform:translateY(12px)',
  ].join(';')

  balloon.innerHTML = `
    <div style="background:linear-gradient(180deg,#0a246a 0%,#a6b4d7 100%);padding:4px 8px;display:flex;align-items:center;justify-content:space-between">
      <span style="color:#fff;font-size:11px;font-weight:bold;display:flex;align-items:center;gap:4px">
        <span style="font-size:14px">ℹ</span> ${title}
      </span>
      <span style="color:#fff;font-size:12px;cursor:pointer">✕</span>
    </div>
    <div style="padding:8px 10px;font-size:11px;color:#000;line-height:1.4">${body}</div>
    <div style="background:#fffacd;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-top:8px solid #c8a000;position:absolute;bottom:-8px;right:16px"></div>
  `

  container.appendChild(balloon)

  gsap.timeline()
    .to(balloon, { opacity: 1, y: 0, duration: 0.35, ease: 'back.out(1.2)' })
    .to(balloon, { opacity: 0, y: 8, duration: 0.3, ease: 'power2.in', delay: holdSec })
    .call(() => { container.innerHTML = ''; gsap.set(container, { display: 'none' }) })
}
