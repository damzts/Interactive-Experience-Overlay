import gsap from 'gsap'
import type { NotificationBoxConfig } from '@ieom/shared'

/** NOTIFICATION-BOX — creates a Win98-style dialog window.
 *  Appended into #tl-notification-stack (flex column), so multiple
 *  boxes stack naturally without overlapping. */

export function runNotificationBox(cfg: NotificationBoxConfig) {
  const stack = document.getElementById('tl-notification-stack')
  if (!stack) return

  // ── Build Win98 window element ──
  const win = document.createElement('div')
  win.className = 'window'
  win.style.cssText = 'width:360px; pointer-events:auto; box-shadow:4px 4px 0 #000; opacity:0; transform:translateX(-24px); flex-shrink:0'

  const titleBar = document.createElement('div')
  titleBar.className = 'title-bar'
  titleBar.innerHTML = `
    <div class="title-bar-text" style="display:flex;align-items:center;gap:6px">
      <span>${cfg.icon}</span><span>${cfg.title}</span>
    </div>
    <div class="title-bar-controls">
      <button aria-label="Close" id="notif-close-${Date.now()}"></button>
    </div>
  `

  const body = document.createElement('div')
  body.className = 'window-body'
  body.style.cssText = 'padding:12px 16px'
  if (cfg.body) {
    const p = document.createElement('p')
    p.style.cssText = "font-family:'MS Sans Serif',Arial,sans-serif;font-size:13px;margin:0;word-break:break-word"
    p.textContent = cfg.body
    body.appendChild(p)
  }

  win.appendChild(titleBar)
  win.appendChild(body)
  stack.appendChild(win)

  // ── Animate in ──
  const tl = gsap.timeline()
  tl.to(win, { opacity: 1, x: 0, duration: 0.25, ease: 'back.out(1.4)' })

  // ── Close handler ──
  const closeBtn = titleBar.querySelector('button[aria-label="Close"]')
  const dismiss = () => {
    tl.kill()
    gsap.to(win, {
      opacity: 0, x: 20, duration: 0.18, ease: 'power2.in',
      onComplete: () => win.remove(),
    })
  }
  closeBtn?.addEventListener('click', dismiss)

  // ── Auto-dismiss ──
  if (cfg.autoDismiss > 0) {
    tl.to(win, { opacity: 0, x: 20, duration: 0.2, ease: 'power2.in', delay: cfg.autoDismiss })
      .call(() => win.remove())
  }
}
