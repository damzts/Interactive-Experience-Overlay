import gsap from 'gsap'
import type { AimMessageConfig } from '@ieomlabs/shared'

/** AIM-MESSAGE — AOL Instant Messenger window slides in from bottom-right. */
export function runAimMessage(cfg: AimMessageConfig) {
  const container = document.getElementById('tl-aim-message')
  if (!container) return

  const username = cfg.username ?? 'NetBuddy420'
  const message  = cfg.message  ?? 'yo that was insane'
  const durationMs = cfg.durationMs ?? 4500
  const holdSec  = durationMs / 1000 - 0.7

  const now = new Date()
  const time = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')} ${now.getHours() >= 12 ? 'PM' : 'AM'}`

  gsap.set(container, { display: 'block' })
  container.innerHTML = ''

  const win = document.createElement('div')
  win.style.cssText = [
    'width:320px',
    'font-family:"MS Sans Serif",Arial,sans-serif',
    'font-size:12px',
    'background:#d4d0c8',
    'border:2px solid',
    'border-color:#ffffff #808080 #808080 #ffffff',
    'box-shadow:2px 2px 0 #000',
    'overflow:hidden',
    'transform:translateY(120px)',
    'opacity:0',
  ].join(';')

  win.innerHTML = `
    <div style="background:linear-gradient(90deg,#000080,#1084d0);padding:3px 6px;display:flex;align-items:center;justify-content:space-between">
      <span style="color:#fff;font-weight:bold;font-size:11px">Instant Message from ${username}</span>
      <span style="color:#fff;cursor:pointer;font-size:11px;font-weight:bold">✕</span>
    </div>
    <div style="background:#fff;border:1px inset #999;margin:6px;padding:8px;min-height:48px;font-size:12px;color:#000;line-height:1.5">
      <span style="color:#000080;font-weight:bold">${username}</span>
      <span style="color:#888;font-size:10px"> (${time}): </span><br/>
      ${message}
    </div>
    <div style="display:flex;gap:4px;padding:4px 6px 8px">
      <button style="flex:1;font-family:inherit;font-size:11px;background:#d4d0c8;border:2px solid;border-color:#fff #808080 #808080 #fff;padding:2px 8px">Send</button>
      <button style="flex:1;font-family:inherit;font-size:11px;background:#d4d0c8;border:2px solid;border-color:#fff #808080 #808080 #fff;padding:2px 8px">Warn</button>
      <button style="flex:1;font-family:inherit;font-size:11px;background:#d4d0c8;border:2px solid;border-color:#fff #808080 #808080 #fff;padding:2px 8px">Block</button>
    </div>
  `

  container.appendChild(win)

  gsap.timeline()
    .to(win, { opacity: 1, y: 0, duration: 0.4, ease: 'back.out(1.3)' })
    .to(win, { opacity: 0, y: 20, duration: 0.3, ease: 'power2.in', delay: holdSec })
    .call(() => { container.innerHTML = ''; gsap.set(container, { display: 'none' }) })
}
