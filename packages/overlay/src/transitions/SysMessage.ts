import gsap from 'gsap'
import type { TerminalToastConfig } from '@ieomlabs/shared'

/** SYS_MESSAGE overlay — terminal toast that types [SERVER] messages. */

const DEFAULT_MESSAGES = [
  '[SERVER]: connection unstable',
  '[SERVER]: packet loss detected (14%)',
  '[SERVER]: resyncing stream buffer',
  '[SYSTEM]: low memory warning',
  '[SYSTEM]: process watchdog active',
  '[NET]: ping spike — 340ms',
  '[NET]: MTU mismatch on eth0',
  '[IO]: disk write latency elevated',
  '[AUTH]: session token refreshed',
  '[WATCHDOG]: all systems nominal',
]

const POSITION_RECT: Record<TerminalToastConfig['position'], string> = {
  'bottom-left':  'bottom:60px;left:48px',
  'bottom-right': 'bottom:60px;right:48px',
  'top-left':     'top:60px;left:48px',
  'top-right':    'top:60px;right:48px',
}

export function runSysMessage(cfg: TerminalToastConfig) {
  const container = document.getElementById('tl-sysmsg-container')
  if (!container) return

  container.innerHTML = ''
  gsap.killTweensOf(container)

  // Position
  const posRect = POSITION_RECT[cfg.position]
  container.style.cssText = [
    'position:fixed',
    posRect,
    'z-index:200',
    'opacity:1',
    'font-family:VT323,monospace',
    'font-size:20px',
    'color:#0f0',
    'text-shadow:0 0 6px #0f0',
    'line-height:1.4',
    'pointer-events:none',
    'background:rgba(0,0,0,0.7)',
    'border:1px solid rgba(0,255,0,0.25)',
    'padding:10px 16px',
    'min-width:280px',
  ].join(';')

  const messages = cfg.messages.length > 0 ? cfg.messages : [DEFAULT_MESSAGES[Math.floor(Math.random() * DEFAULT_MESSAGES.length)]]

  const tl = gsap.timeline()
  tl.set(container, { opacity: 1 })

  messages.forEach((msg, i) => {
    const line = document.createElement('div')
    line.style.cssText = 'opacity:0;margin-bottom:4px;white-space:nowrap;overflow:hidden;max-width:0px'
    line.textContent = msg
    container.appendChild(line)
    tl.to(line, { opacity: 1, maxWidth: 600, duration: Math.max(0.05 * msg.length, 0.2), ease: 'steps(' + Math.max(msg.length, 1) + ')' }, i * 0.45)
  })

  const holdDur = Math.max(cfg.duration - messages.length * 0.45 - 0.8, 0.5)
  tl.to({}, { duration: holdDur })
  tl.to(Array.from(container.children) as HTMLElement[], { opacity: 0, duration: 0.5, stagger: 0.08, ease: 'power2.in' })
    .set(container, { opacity: 0 })
    .call(() => { container.innerHTML = '' })
}
