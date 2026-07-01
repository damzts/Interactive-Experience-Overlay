import gsap from 'gsap'
import type { EmailAlertConfig } from '@ieomlabs/shared'

/** EMAIL-ALERT — Hotmail/AOL new-message notification card with bouncing envelope. */
export function runEmailAlert(cfg: EmailAlertConfig) {
  const container = document.getElementById('tl-email-alert')
  if (!container) return

  const subject  = cfg.subject ?? 'You have won a FREE iPod!!'
  const sender   = cfg.sender  ?? 'noreply@hotmail.com'
  const holdSec  = (cfg.durationMs ?? 4000) / 1000 - 0.7

  gsap.set(container, { display: 'block' })
  container.innerHTML = ''

  const card = document.createElement('div')
  card.style.cssText = [
    'width:300px',
    'background:linear-gradient(180deg,#ffffff,#f0f0f0)',
    'border:2px solid #0000cc',
    'border-radius:4px',
    'box-shadow:3px 3px 10px rgba(0,0,100,0.3)',
    'font-family:"Tahoma",Arial,sans-serif',
    'overflow:hidden',
    'opacity:0',
    'transform:scale(0.8) translateY(16px)',
  ].join(';')

  const envId = `env-${Date.now()}`

  card.innerHTML = `
    <div style="background:linear-gradient(90deg,#003399,#0055cc);padding:5px 10px;display:flex;align-items:center;justify-content:space-between">
      <span style="color:#fff;font-weight:bold;font-size:12px">📧 Hotmail</span>
      <span style="color:#aac;font-size:11px">Microsoft</span>
    </div>
    <div style="padding:12px 14px;display:flex;gap:10px;align-items:center">
      <div id="${envId}" style="font-size:36px">✉️</div>
      <div>
        <div style="font-size:11px;color:#333">From: <span style="color:#0000cc">${sender}</span></div>
        <div style="font-size:12px;font-weight:bold;color:#000;margin-top:2px">${subject}</div>
        <div style="font-size:11px;color:#0000cc;margin-top:4px;text-decoration:underline;cursor:pointer">Click to read →</div>
      </div>
    </div>
    <div style="background:#f0f0ff;border-top:1px solid #ccc;padding:4px 14px;font-size:10px;color:#666">
      You have 1 new message in your inbox.
    </div>
  `

  container.appendChild(card)

  const env = document.getElementById(envId)

  gsap.timeline()
    .to(card, { opacity: 1, scale: 1, y: 0, duration: 0.35, ease: 'back.out(1.4)' })
    .to(env, { y: -6, duration: 0.2, ease: 'power2.out', yoyo: true, repeat: 3 })
    .to(card, { opacity: 0, y: 12, duration: 0.3, ease: 'power2.in', delay: holdSec })
    .call(() => { container.innerHTML = ''; gsap.set(container, { display: 'none' }) })
}
