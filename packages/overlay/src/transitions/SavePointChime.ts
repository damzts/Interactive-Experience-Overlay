import gsap from 'gsap'
import type { SavePointChimeConfig } from '@ieomlabs/shared'

/** SAVE-POINT-CHIME — Save Point. A JRPG level-up card: the ATB-style gauge
 *  freezes full, a gold/blue crystal-bordered card announces the new job title. */
export function runSavePointChime(cfg: SavePointChimeConfig) {
  const container = document.getElementById('tl-save-point-chime')
  if (!container) return

  const title    = cfg.title ?? 'LEVEL UP'
  const jobTitle = cfg.jobTitle ?? 'Novice'
  const dur      = cfg.duration ?? 3.4

  gsap.set(container, { display: 'block' })
  container.innerHTML = `
    <div id="tl-sp-bar" style="
      position:absolute; left:50%; bottom:22%; transform:translateX(-50%); width:46vw; max-width:520px; height:12px;
      background:rgba(12,18,38,0.8); border:1px solid #5b7cff; border-radius:2px; overflow:hidden;
    ">
      <div id="tl-sp-bar-fill" style="width:0%; height:100%; background:linear-gradient(90deg,#5b7cff,#ffd166);"></div>
    </div>
    <div id="tl-sp-card" style="
      position:absolute; left:50%; top:50%; transform:translate(-50%,-50%) scale(0.6); opacity:0;
      background:linear-gradient(180deg,#1c2a52,#101830);
      box-shadow:inset 0 0 0 2px #5b7cff, inset 0 0 0 5px #0c1226, 0 0 40px rgba(91,124,255,0.5);
      padding:22px 46px; text-align:center; clip-path:polygon(6% 0,94% 0,100% 100%,0 100%);
    ">
      <div style="font-family:Orbitron,sans-serif; font-size:14px; letter-spacing:6px; color:#ffd166">${title}</div>
      <div style="font-family:Orbitron,sans-serif; font-size:30px; letter-spacing:2px; color:#eaf0ff; text-shadow:0 0 16px #5b7cff; margin-top:6px">${jobTitle}</div>
    </div>
  `

  const fill = container.querySelector('#tl-sp-bar-fill')
  const card = container.querySelector('#tl-sp-card')

  gsap.timeline()
    .to(fill, { width: '100%', duration: 0.9, ease: 'power2.out' })
    .to(card, { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(1.6)' }, '<0.15')
    .to(card, { opacity: 0, scale: 0.85, duration: 0.4, ease: 'power2.in', delay: Math.max(dur - 1.7, 0.6) })
    .to(fill, { opacity: 0, duration: 0.3 }, '<')
    .call(() => { container.innerHTML = ''; gsap.set(container, { display: 'none' }) })
}
