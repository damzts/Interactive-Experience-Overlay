import gsap from 'gsap'
import type { QuestCompleteConfig } from '@ieomlabs/shared'

/** QUEST-COMPLETE — quest banner fanfare slides in from top, holds, slides out. */
export function runQuestComplete(cfg: QuestCompleteConfig) {
  const container = document.getElementById('tl-quest-complete')
  if (!container) return

  const title  = cfg.title  ?? 'Quest Complete!'
  const reward = cfg.reward ?? ''
  const dur    = cfg.duration ?? 3.5

  gsap.set(container, { display: 'block' })
  container.innerHTML = `
    <div id="tl-quest-banner" style="
      position:absolute; left:50%; top:14%; transform:translate(-50%,-120%);
      background:linear-gradient(180deg,#2a1f0a,#120d04); border:2px solid #c9a24b;
      padding:14px 40px; text-align:center; box-shadow:0 0 24px #c9a24b66;
    ">
      <div style="font-family:VT323,monospace;font-size:14px;letter-spacing:6px;color:#c9a24b">QUEST COMPLETE</div>
      <div style="font-family:VT323,monospace;font-size:32px;color:#ffe9b0;text-shadow:0 0 12px #ffd76b;margin-top:2px">${title}</div>
      ${reward ? `<div style="font-family:VT323,monospace;font-size:18px;color:#6bcb77;margin-top:4px">+ ${reward}</div>` : ''}
    </div>
  `

  const banner = container.querySelector('#tl-quest-banner')
  if (!banner) return

  gsap.timeline()
    .to(banner, { transform: 'translate(-50%,0%)', duration: 0.6, ease: 'back.out(1.4)' })
    .to(banner, { transform: 'translate(-50%,-120%)', duration: 0.5, ease: 'power2.in', delay: Math.max(dur - 1.1, 0.5) })
    .call(() => { container.innerHTML = ''; gsap.set(container, { display: 'none' }) })
}
