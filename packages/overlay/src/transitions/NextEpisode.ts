import gsap from 'gsap'
import type { NextEpisodeConfig } from '@ieomlabs/shared'

/** NEXT-EPISODE — Signal Ghost. A VHS-tracking anime bumper title card:
 *  episode number, one-line preview caption, hard cut like a commercial break. */
export function runNextEpisode(cfg: NextEpisodeConfig) {
  const container = document.getElementById('tl-next-episode')
  if (!container) return

  const ep      = Math.max(1, Math.round(cfg.episodeNumber ?? 1))
  const title   = cfg.title ?? 'Next Episode'
  const preview = cfg.previewText ?? ''
  const dur     = cfg.duration ?? 3.6

  gsap.set(container, { display: 'block' })
  container.innerHTML = `
    <div id="tl-ne-bg" style="position:absolute; inset:0; background:#0d0d14; opacity:0;"></div>
    <div id="tl-ne-tracking" style="
      position:absolute; left:0; right:0; height:14px; top:30%;
      background:repeating-linear-gradient(to bottom, rgba(255,46,136,0.5) 0 2px, transparent 2px 4px);
      opacity:0;
    "></div>
    <div id="tl-ne-card" style="
      position:absolute; left:50%; top:50%; transform:translate(-50%,-50%) scale(0.85); opacity:0;
      text-align:center; white-space:nowrap;
    ">
      <div style="font-family:Share Tech Mono,monospace; font-size:13px; letter-spacing:6px; color:#22e6ff; text-shadow:2px 0 #ff2e88">EPISODE ${ep}</div>
      <div style="font-family:Share Tech Mono,monospace; font-size:44px; letter-spacing:2px; color:#fff; text-shadow:2px 0 #ff2e88,-2px 0 #22e6ff; margin-top:6px">${title}</div>
      ${preview ? `<div style="font-family:Share Tech Mono,monospace; font-size:16px; color:#ff2e88; margin-top:10px; letter-spacing:1px">${preview}</div>` : ''}
    </div>
  `

  const bg = container.querySelector('#tl-ne-bg')
  const tracking = container.querySelector('#tl-ne-tracking')
  const card = container.querySelector('#tl-ne-card')

  gsap.timeline()
    .to(bg, { opacity: 1, duration: 0.15 })
    .to(tracking, { opacity: 0.8, top: '70%', duration: 0.4, ease: 'power1.inOut' }, '<')
    .to(card, { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(1.5)' }, '<0.1')
    .to(tracking, { opacity: 0, duration: 0.3 }, '>-0.1')
    .to([bg, card], { opacity: 0, duration: 0.2, delay: Math.max(dur - 1.2, 0.6) })
    .call(() => { container.innerHTML = ''; gsap.set(container, { display: 'none' }) })
}
