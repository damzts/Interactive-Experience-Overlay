import gsap from 'gsap'
import type { MsnNudgeConfig } from '@ieomlabs/shared'

/** MSN-NUDGE — Windows Live Messenger nudge: balloon + violent screen shake. */
export function runMsnNudge(cfg: MsnNudgeConfig) {
  const container = document.getElementById('tl-msn-nudge')
  if (!container) return

  const username = cfg.username ?? 'LiveBuddy'
  const holdSec = (cfg.durationMs ?? 3500) / 1000 - 0.5

  // Screen shake on overlay-root
  const root = document.getElementById('overlay-root')
  if (root) {
    const shakes = Array.from({ length: 12 }, (_, i) => ({
      x: (Math.random() - 0.5) * 18,
      y: (Math.random() - 0.5) * 18,
      duration: 0.05,
    }))
    const tl = gsap.timeline()
    shakes.forEach(s => tl.to(root, { x: s.x, y: s.y, duration: s.duration, ease: 'none' }))
    tl.to(root, { x: 0, y: 0, duration: 0.08 })
  }

  gsap.set(container, { display: 'block' })
  container.innerHTML = ''

  const balloon = document.createElement('div')
  balloon.style.cssText = [
    'width:280px',
    'background:#fff',
    'border:1px solid #ccc',
    'border-radius:6px 6px 0 6px',
    'box-shadow:2px 4px 12px rgba(0,0,0,0.25)',
    'padding:10px 14px',
    'font-family:"Segoe UI",Arial,sans-serif',
    'font-size:13px',
    'opacity:0',
    'transform:translateY(16px)',
  ].join(';')

  balloon.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <div style="width:32px;height:32px;background:linear-gradient(135deg,#00aeef,#0057a8);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px">💬</div>
      <div>
        <div style="font-weight:bold;color:#0057a8;font-size:12px">${username}</div>
        <div style="font-size:11px;color:#666">Windows Live Messenger</div>
      </div>
    </div>
    <div style="color:#333">🌊 <strong>${username}</strong> sent you a <strong style="color:#0057a8">Nudge!</strong></div>
  `

  container.appendChild(balloon)

  gsap.timeline()
    .to(balloon, { opacity: 1, y: 0, duration: 0.35, ease: 'back.out(1.4)' })
    .to(balloon, { opacity: 0, y: 10, duration: 0.3, ease: 'power2.in', delay: holdSec })
    .call(() => { container.innerHTML = ''; gsap.set(container, { display: 'none' }) })
}
