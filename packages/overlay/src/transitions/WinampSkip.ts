import gsap from 'gsap'
import type { WinampSkipConfig } from '@ieomlabs/shared'

/** WINAMP-SKIP — Winamp media player widget with VU meter bars and track skip. */
export function runWinampSkip(cfg: WinampSkipConfig) {
  const container = document.getElementById('tl-winamp-skip')
  if (!container) return

  const track  = cfg.track  ?? 'Track 04'
  const artist = cfg.artist ?? 'Unknown Artist'
  const holdMs = cfg.durationMs ?? 4000

  gsap.set(container, { display: 'block' })
  container.innerHTML = ''

  const widget = document.createElement('div')
  widget.style.cssText = [
    'width:280px',
    'background:#1a1a1a',
    'border:1px solid #444',
    'border-top:2px solid #555',
    'font-family:"Courier New",monospace',
    'overflow:hidden',
    'opacity:0',
    'transform:translateX(20px)',
  ].join(';')

  const barIds = Array.from({ length: 10 }, (_, i) => `wb-${Date.now()}-${i}`)

  widget.innerHTML = `
    <div style="background:linear-gradient(180deg,#1e5a1e,#0a2a0a);padding:3px 6px;display:flex;align-items:center;justify-content:space-between">
      <span style="color:#99ff66;font-size:10px;font-weight:bold;letter-spacing:1px">WINAMP</span>
      <span style="color:#99ff66;font-size:10px">▶|◀ ■ ▶▶</span>
    </div>
    <div style="padding:6px 8px;background:#0a1a0a">
      <div style="color:#99ff66;font-size:10px;white-space:nowrap;overflow:hidden;margin-bottom:4px" id="${barIds[0]}">
        ▶▶ TRACK SKIPPED — ${artist} — ${track}
      </div>
      <div style="display:flex;gap:2px;height:20px;align-items:flex-end">
        ${barIds.slice(1).map((id, i) => `<div id="${id}" style="width:20px;background:#00cc00;height:${4 + i * 2}px;flex-shrink:0"></div>`).join('')}
      </div>
    </div>
    <div style="background:#0a1a0a;padding:2px 8px 4px">
      <div style="height:4px;background:#003300;border-radius:2px;overflow:hidden">
        <div style="height:100%;width:35%;background:#00cc00"></div>
      </div>
    </div>
  `

  container.appendChild(widget)

  // Animate VU bars
  const vuBars = barIds.slice(1).map(id => document.getElementById(id))
  let vuInterval: ReturnType<typeof setInterval> | null = null

  gsap.timeline()
    .to(widget, {
      opacity: 1, x: 0, duration: 0.35, ease: 'power2.out',
      onComplete() {
        vuInterval = setInterval(() => {
          vuBars.forEach(bar => {
            if (bar) bar.style.height = (4 + Math.random() * 22) + 'px'
          })
        }, 80)
      },
    })
    .to(widget, { opacity: 0, x: 20, duration: 0.3, ease: 'power2.in', delay: holdMs / 1000 - 0.65 })
    .call(() => {
      if (vuInterval) clearInterval(vuInterval)
      container.innerHTML = ''
      gsap.set(container, { display: 'none' })
    })
}
