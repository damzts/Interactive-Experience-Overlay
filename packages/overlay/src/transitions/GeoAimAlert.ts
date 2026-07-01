import gsap from 'gsap'
import type { GeoAimAlertConfig } from '@ieomlabs/shared'

let blinkStyleInjected = false

/** GEOCITIES-ALERT — Browser-era JS alert() dialog with blinking border. */
export function runGeoAimAlert(cfg: GeoAimAlertConfig) {
  const container = document.getElementById('tl-geocities-alert')
  if (!container) return

  const message  = cfg.message ?? 'Welcome to MY STREAM!! Please sign my GUESTBOOK!! ⭐🌟⭐ This site is best viewed in 800x600!!'
  const holdSec  = (cfg.durationMs ?? 5000) / 1000 - 0.6

  if (!blinkStyleInjected) {
    blinkStyleInjected = true
    const s = document.createElement('style')
    s.textContent = `
      @keyframes geocities-border-blink {
        0%,100% { border-color:#ff00ff; }
        25% { border-color:#ffff00; }
        50% { border-color:#00ffff; }
        75% { border-color:#ff6600; }
      }
      .geocities-dialog { animation: geocities-border-blink 0.4s linear infinite; }
    `
    document.head.appendChild(s)
  }

  gsap.set(container, { display: 'block' })
  container.innerHTML = ''

  const dialog = document.createElement('div')
  dialog.className = 'geocities-dialog'
  dialog.style.cssText = [
    'width:360px',
    'background:#c0c0c0',
    'border:4px solid #ff00ff',
    'box-shadow:4px 4px 0 #000,inset 1px 1px 0 #fff,inset -1px -1px 0 #808080',
    'font-family:"MS Sans Serif",Arial,sans-serif',
    'font-size:12px',
    'opacity:0',
    'transform:scale(0.7)',
  ].join(';')

  dialog.innerHTML = `
    <div style="background:linear-gradient(90deg,#000080,#1084d0);padding:3px 6px;display:flex;align-items:center;justify-content:space-between;margin-bottom:1px">
      <span style="color:#fff;font-weight:bold;font-size:11px;display:flex;align-items:center;gap:4px">
        <span>🌐</span> Microsoft Internet Explorer
      </span>
      <span style="color:#fff;font-size:11px">✕</span>
    </div>
    <div style="padding:16px;display:flex;gap:12px;align-items:flex-start">
      <div style="font-size:32px;flex-shrink:0">⚠️</div>
      <div style="line-height:1.5;color:#000">${message}</div>
    </div>
    <div style="padding:0 16px 12px;display:flex;justify-content:center">
      <button style="font-family:inherit;font-size:12px;background:#d4d0c8;border:2px solid;border-color:#fff #808080 #808080 #fff;padding:4px 28px;min-width:80px">OK</button>
    </div>
  `

  container.appendChild(dialog)

  gsap.timeline()
    .to(dialog, { opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(1.5)' })
    .to(dialog, { opacity: 0, scale: 0.8, duration: 0.3, ease: 'power2.in', delay: holdSec })
    .call(() => { container.innerHTML = ''; gsap.set(container, { display: 'none' }) })
}
