import gsap from 'gsap'
import type { IntermissionConfig } from '@ieomlabs/shared'

/** INTERMISSION — full-screen BRB card with animated scanlines + timer. */
export function runIntermission(cfg: IntermissionConfig) {
  const container = document.getElementById('tl-intermission')
  if (!container) return

  const msg = cfg.message ?? 'Be Right Back'

  gsap.set(container, { display: 'block', opacity: 0 })
  container.innerHTML = ''

  // Background
  const bg = document.createElement('div')
  bg.style.cssText = `position:absolute;inset:0;background:linear-gradient(135deg,#0a0a0f 0%,#111128 100%)`
  container.appendChild(bg)

  // Animated CRT scanline overlay
  const scanlines = document.createElement('div')
  scanlines.style.cssText = [
    'position:absolute', 'inset:0',
    "background:repeating-linear-gradient(0deg,rgba(0,0,0,0.15) 0px,rgba(0,0,0,0.15) 1px,transparent 1px,transparent 3px)",
    'pointer-events:none',
  ].join(';')
  container.appendChild(scanlines)

  // Center content
  const content = document.createElement('div')
  content.style.cssText = [
    'position:absolute', 'left:50%', 'top:50%',
    'transform:translate(-50%,-50%)',
    'text-align:center', 'font-family:VT323,monospace',
  ].join(';')

  let timerHtml = ''
  if (cfg.showTimer) {
    timerHtml = `<div id="tl-intermission-timer" style="font-size:48px;color:#888;letter-spacing:6px;margin-top:16px">00:00</div>`
  }

  content.innerHTML = `
    <div style="font-size:22px;color:#444;letter-spacing:6px;text-transform:uppercase;margin-bottom:12px">[ INTERMISSION ]</div>
    <div style="font-size:64px;color:#fff;letter-spacing:4px;text-shadow:0 0 20px rgba(255,255,255,0.3)">${msg}</div>
    ${timerHtml}
    <div style="font-size:18px;color:#333;letter-spacing:4px;margin-top:20px">Stream resumes shortly</div>
  `
  container.appendChild(content)

  // Timer logic
  if (cfg.showTimer) {
    let elapsed = 0
    const timerEl = container.querySelector<HTMLElement>('#tl-intermission-timer')
    const timerInterval = setInterval(() => {
      elapsed++
      const m = Math.floor(elapsed / 60)
      const s = elapsed % 60
      if (timerEl) timerEl.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    }, 1000)
    gsap.delayedCall(cfg.duration, () => clearInterval(timerInterval))
  }

  const fade = 0.5
  const hold = cfg.duration - fade * 2

  gsap.timeline()
    .to(container, { opacity: 1, duration: fade, ease: 'power2.in' })
    .to(container, { opacity: 0, duration: fade, ease: 'power2.out', delay: hold })
    .call(() => { container.innerHTML = ''; gsap.set(container, { display: 'none' }) })
}
