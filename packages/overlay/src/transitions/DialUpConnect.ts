import gsap from 'gsap'
import type { DialUpConnectConfig } from '@ieomlabs/shared'

/** DIAL-UP-CONNECT — modem handshake terminal animation. */
export function runDialUpConnect(cfg: DialUpConnectConfig) {
  const container = document.getElementById('tl-dialup')
  if (!container) return

  const isp   = cfg.isp   ?? 'STREAMING SERVICE'
  const speed = cfg.speed ?? '56k'

  const lines = [
    `> Dialing ${isp}...`,
    '> ATDT *99***1#',
    '> CONNECT',
    `> Negotiating ${speed}...`,
    '> Compression: V.42bis',
    `> Protocol: V.90/${speed.toUpperCase()}`,
    '> Authentication accepted',
    '> PPP layer initialized',
    '> Stream session established.',
  ]

  const win = document.createElement('div')
  win.style.cssText = [
    'background:#000', 'border:1px solid #0f0', 'padding:12px 20px',
    'font-family:VT323,monospace', 'font-size:18px', 'color:#0f0',
    'min-width:420px', 'line-height:1.6', 'opacity:1',
    'text-shadow:0 0 6px #0f0',
  ].join(';')

  container.style.display = 'block'
  container.appendChild(win)

  const perLine = (cfg.duration - 0.8) / lines.length
  let i = 0

  const interval = setInterval(() => {
    if (i < lines.length) {
      const p = document.createElement('div')
      p.textContent = lines[i++]
      win.appendChild(p)
    } else {
      clearInterval(interval)
      gsap.to(win, {
        opacity: 0, duration: 0.5, delay: 0.3,
        onComplete: () => { win.remove(); container.style.display = 'none' },
      })
    }
  }, perLine * 1000)
}
