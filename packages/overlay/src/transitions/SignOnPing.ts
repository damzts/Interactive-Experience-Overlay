import gsap from 'gsap'
import type { SignOnPingConfig } from '@ieomlabs/shared'

/** SIGN-ON-PING — Dial Tone Dream. A pastel gel buddy-list card slides in
 *  bottom-right exactly like an old IM client sign-on, rendered glass-bright. */
export function runSignOnPing(cfg: SignOnPingConfig) {
  const container = document.getElementById('tl-sign-on-ping')
  if (!container) return

  const username = cfg.username ?? 'newBuddy99'
  const status   = cfg.status ?? 'is now online'
  const durationMs = cfg.durationMs ?? 3500

  const card = document.createElement('div')
  card.style.cssText = [
    'display:flex', 'align-items:center', 'gap:12px',
    'background:linear-gradient(160deg,#ffffff,#ffe3f3 45%,#d9f4ff)',
    'border:2px solid rgba(255,255,255,0.8)',
    'border-radius:16px',
    'padding:12px 20px',
    'font-family:Trebuchet MS,Verdana,Arial,sans-serif',
    'color:#5a2b58', 'font-size:16px',
    'box-shadow:0 6px 18px rgba(255,158,203,0.4), inset 0 1px 0 rgba(255,255,255,0.9)',
    'white-space:nowrap',
    'transform:translateX(140px)', 'opacity:0',
  ].join(';')
  card.innerHTML = `
    <span style="width:12px;height:12px;border-radius:50%;background:#5ee08a;box-shadow:0 0 8px #5ee08a;display:inline-block"></span>
    <span><span style="font-weight:bold;color:#ff5c9e">${username}</span> <span style="opacity:0.8">${status}</span></span>
  `

  container.style.display = 'block'
  container.appendChild(card)

  const holdDur = (durationMs / 1000) - 0.7
  gsap.timeline()
    .to(card, { x: 0, opacity: 1, duration: 0.4, ease: 'back.out(1.3)' })
    .to(card, { opacity: 0, x: 60, duration: 0.3, ease: 'power2.in', delay: Math.max(holdDur, 0.3) })
    .call(() => {
      card.remove()
      if (!container.children.length) container.style.display = 'none'
    })
}
