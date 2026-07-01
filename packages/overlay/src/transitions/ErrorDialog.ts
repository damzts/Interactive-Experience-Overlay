import gsap from 'gsap'
import type { ErrorDialogConfig } from '@ieomlabs/shared'

/** ERROR-DIALOG — Win98/XP-style error box with phantom OK button. */
export function runErrorDialog(cfg: ErrorDialogConfig) {
  const container = document.getElementById('tl-error-dialog')
  if (!container) return

  const durationMs = cfg.durationMs ?? 3500

  const win = document.createElement('div')
  win.className = 'window'
  win.style.cssText = 'width:360px;box-shadow:4px 4px 0 #000;opacity:0;transform:scale(0.92)'
  win.innerHTML = `
    <div class="title-bar">
      <div class="title-bar-text" style="display:flex;align-items:center;gap:6px">
        <span>⚠</span><span>${cfg.title}</span>
      </div>
      <div class="title-bar-controls"><button aria-label="Close"></button></div>
    </div>
    <div class="window-body" style="padding:16px">
      <div style="display:flex;align-items:flex-start;gap:12px">
        <span style="font-size:32px;line-height:1">⛔</span>
        <p style="font-family:'MS Sans Serif',Arial,sans-serif;font-size:13px;margin:0;line-height:1.5">${cfg.message}</p>
      </div>
      <div style="margin-top:14px;display:flex;justify-content:center">
        <button style="min-width:72px;padding:4px 12px;font-family:'MS Sans Serif',Arial,sans-serif;font-size:13px">OK</button>
      </div>
    </div>
  `

  container.style.display = 'block'
  container.appendChild(win)

  const holdDur = (durationMs / 1000) - 0.35
  gsap.timeline()
    .to(win, { opacity: 1, scale: 1, duration: 0.15, ease: 'power2.out' })
    .to(win, { opacity: 0, scale: 0.9, duration: 0.2, ease: 'power2.in', delay: Math.max(holdDur, 0.3) })
    .call(() => { win.remove(); container.style.display = 'none' })
}
