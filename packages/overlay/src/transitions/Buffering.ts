import gsap from 'gsap'
import type { BufferingConfig } from '@ieomlabs/shared'

/** BUFFERING — Early YouTube progress bar fills to 100%, then screen "plays". */
export function runBuffering(cfg: BufferingConfig) {
  const container = document.getElementById('tl-buffering')
  if (!container) return

  const quality  = cfg.quality ?? '360p'
  const duration = cfg.duration ?? 4

  gsap.set(container, { display: 'block' })
  container.innerHTML = ''

  const overlay = document.createElement('div')
  overlay.style.cssText = [
    'position:absolute', 'inset:0',
    'background:rgba(0,0,0,0.75)',
    'display:flex', 'flex-direction:column',
    'align-items:center', 'justify-content:center',
    'gap:16px',
    'opacity:0',
  ].join(';')

  overlay.innerHTML = `
    <div style="font-family:Arial,sans-serif;color:#ccc;font-size:13px;letter-spacing:2px">▶ ${quality}</div>
    <div style="font-family:Arial,sans-serif;color:#fff;font-size:28px;font-weight:bold;letter-spacing:3px">BUFFERING...</div>
    <div style="width:360px;background:#333;border-radius:3px;overflow:hidden;height:6px">
      <div id="tl-buffering-bar" style="height:100%;width:0%;background:#cc0000;transition:none"></div>
    </div>
    <div id="tl-buffering-pct" style="font-family:Arial,sans-serif;color:#ccc;font-size:12px">0%</div>
    <div style="font-family:Arial,sans-serif;color:#555;font-size:11px">Sorry for the interruption. Please wait...</div>
  `

  container.appendChild(overlay)

  const bar = overlay.querySelector<HTMLElement>('#tl-buffering-bar')
  const pct = overlay.querySelector<HTMLElement>('#tl-buffering-pct')

  const fillTime = duration * 0.75
  const barProxy = { value: 0 }

  gsap.timeline()
    .to(overlay, { opacity: 1, duration: 0.35 })
    .to(barProxy, {
      value: 100,
      duration: fillTime,
      ease: 'power1.inOut',
      onUpdate() {
        const v = Math.round(barProxy.value)
        if (bar) bar.style.width = v + '%'
        if (pct) pct.textContent = v + '%'
      },
    })
    .to(overlay, { opacity: 0, duration: 0.4 })
    .call(() => { container.innerHTML = ''; gsap.set(container, { display: 'none' }) })
}
