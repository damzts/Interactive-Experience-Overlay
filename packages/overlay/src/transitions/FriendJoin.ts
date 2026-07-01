import gsap from 'gsap'
import type { FriendJoinConfig } from '@ieomlabs/shared'

/** FRIEND-JOIN — Xbox Live / Messenger style friend-joined slide-in from bottom-right. */
export function runFriendJoin(cfg: FriendJoinConfig) {
  const container = document.getElementById('tl-friend-join')
  if (!container) return

  const durationMs = cfg.durationMs ?? 3500

  const box = document.createElement('div')
  box.style.cssText = [
    'display:flex', 'align-items:center', 'gap:10px',
    'background:linear-gradient(135deg,#0d1a2e,#1a2d4a)',
    'border:2px solid #4488ff',
    'padding:10px 18px',
    'font-family:VT323,monospace', 'color:#aaccff', 'font-size:20px', 'letter-spacing:1px',
    'box-shadow:0 0 14px #4488ff55, 4px 4px 0 #000',
    'white-space:nowrap',
    'transform:translateX(120px)', 'opacity:0',
  ].join(';')

  box.innerHTML = `
    <span style="color:#88aaff;font-size:22px">▶</span>
    <span>
      <span style="color:#fff;font-weight:bold">${cfg.username}</span>
      ${cfg.tagline ? ` ${cfg.tagline}` : ' joined the session'}
    </span>
  `

  container.style.display = 'block'
  container.appendChild(box)

  const holdDur = (durationMs / 1000) - 0.65
  gsap.timeline()
    .to(box, { x: 0, opacity: 1, duration: 0.35, ease: 'back.out(1.2)' })
    .to(box, { opacity: 0, x: 60, duration: 0.3, ease: 'power2.in', delay: Math.max(holdDur, 0.3) })
    .call(() => {
      box.remove()
      if (!container.children.length) container.style.display = 'none'
    })
}
