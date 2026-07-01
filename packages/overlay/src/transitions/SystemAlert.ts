import gsap from 'gsap'
import type { SystemAlertConfig } from '@ieomlabs/shared'

/** SYSTEM-ALERT — Vista UAC-style security dialog slides in at screen center. */
export function runSystemAlert(cfg: SystemAlertConfig) {
  const container = document.getElementById('tl-system-alert')
  if (!container) return

  const durationMs = cfg.durationMs ?? 4000

  const dialog = document.createElement('div')
  dialog.style.cssText = [
    'background:#fff', 'border:2px solid #0063b1',
    'padding:20px 24px', 'min-width:340px', 'max-width:480px',
    'box-shadow:0 8px 40px rgba(0,0,0,0.6)',
    'font-family:Segoe UI,Arial,sans-serif',
    'opacity:0', 'transform:scale(0.9)',
  ].join(';')

  dialog.innerHTML = `
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px">
      <span style="font-size:36px">🛡️</span>
      <div style="font-size:15px;font-weight:bold;color:#333">${cfg.title}</div>
    </div>
    <div style="font-size:13px;color:#555;line-height:1.6;margin-bottom:18px">${cfg.message}</div>
    <div style="display:flex;justify-content:flex-end;gap:8px">
      <button style="padding:6px 18px;background:#0063b1;color:#fff;border:none;font-size:13px;cursor:default">Allow</button>
      <button style="padding:6px 18px;background:#e0e0e0;color:#333;border:1px solid #bbb;font-size:13px;cursor:default">Cancel</button>
    </div>
  `

  container.style.display = 'block'
  container.appendChild(dialog)

  const holdDur = (durationMs / 1000) - 0.45
  gsap.timeline()
    .to(dialog, { opacity: 1, scale: 1, duration: 0.25, ease: 'back.out(1.2)' })
    .to(dialog, { opacity: 0, scale: 0.92, duration: 0.2, ease: 'power2.in', delay: Math.max(holdDur, 0.3) })
    .call(() => { dialog.remove(); container.style.display = 'none' })
}
