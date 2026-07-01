import gsap from 'gsap'
import type { AchievementUnlockConfig } from '@ieomlabs/shared'

/** ACHIEVEMENT-UNLOCK — Xbox 360-style achievement toast slides up from bottom-right. */
export function runAchievementUnlock(cfg: AchievementUnlockConfig) {
  const container = document.getElementById('tl-achievement-unlock')
  if (!container) return

  const durationMs = cfg.durationMs ?? 4000

  const box = document.createElement('div')
  box.style.cssText = [
    'display:flex', 'align-items:center', 'gap:12px',
    'background:linear-gradient(135deg,#1a1200,#3a2800)',
    'border:2px solid #c8960c',
    'padding:12px 20px',
    'min-width:320px', 'max-width:420px',
    'box-shadow:0 0 16px #c8960c88, 4px 4px 0 #000',
    'transform:translateY(80px)', 'opacity:0',
  ].join(';')

  const iconHtml = cfg.icon
    ? `<span style="font-size:32px;line-height:1">${cfg.icon}</span>`
    : `<span style="font-size:28px;line-height:1;color:#c8960c">🏆</span>`

  const pointsHtml = cfg.points != null
    ? `<span style="color:#c8960c;font-size:16px"> &mdash; ${cfg.points}G</span>`
    : ''

  box.innerHTML = `
    ${iconHtml}
    <div style="flex:1">
      <div style="color:#f5c400;font-size:13px;letter-spacing:3px;text-transform:uppercase;font-family:VT323,monospace">Achievement Unlocked${pointsHtml}</div>
      <div style="color:#fff;font-size:20px;letter-spacing:1px;font-family:VT323,monospace">${cfg.title}</div>
      ${cfg.description ? `<div style="color:#aaa;font-size:15px;font-family:VT323,monospace">${cfg.description}</div>` : ''}
    </div>
  `

  container.style.display = 'block'
  container.appendChild(box)

  const holdDur = (durationMs / 1000) - 0.7
  gsap.timeline()
    .to(box, { y: 0, opacity: 1, duration: 0.4, ease: 'back.out(1.4)' })
    .to(box, { opacity: 0, y: -20, duration: 0.3, ease: 'power2.in', delay: Math.max(holdDur, 0.3) })
    .call(() => {
      box.remove()
      if (!container.children.length) container.style.display = 'none'
    })
}
