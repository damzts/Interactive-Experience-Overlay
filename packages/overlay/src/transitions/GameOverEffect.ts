import gsap from 'gsap'
import type { GameOverEffectConfig } from '@ieomlabs/shared'

/** GAME-OVER-EFFECT — retro pixel-art GAME OVER wipe, black fade + blocky text. */
export function runGameOverEffect(cfg: GameOverEffectConfig) {
  const container = document.getElementById('tl-game-over')
  if (!container) return

  const text = cfg.text ?? 'GAME OVER'
  const dur  = cfg.duration ?? 3.5

  gsap.set(container, { display: 'block' })
  container.innerHTML = `
    <div id="tl-gameover-bg" style="position:absolute;inset:0;background:#000;opacity:0"></div>
    <div id="tl-gameover-text" style="
      position:absolute; left:50%; top:50%; transform:translate(-50%,-50%) scale(0.5);
      font-family:'Press Start 2P',VT323,monospace; font-size:56px; color:#ff2222;
      text-shadow:4px 4px 0 #550000; opacity:0; white-space:nowrap; image-rendering:pixelated;
    ">${text}</div>
    <div id="tl-gameover-sub" style="
      position:absolute; left:50%; top:64%; transform:translate(-50%,0); opacity:0;
      font-family:VT323,monospace; font-size:20px; color:#888; letter-spacing:4px;
    ">INSERT COIN TO CONTINUE</div>
  `

  const bg  = container.querySelector('#tl-gameover-bg')
  const txt = container.querySelector('#tl-gameover-text')
  const sub = container.querySelector('#tl-gameover-sub')

  gsap.timeline()
    .to(bg,  { opacity: 0.85, duration: 0.5 })
    .to(txt, { opacity: 1, scale: 1, duration: 0.5, ease: 'steps(6)' }, 0.2)
    .to(sub, { opacity: 1, duration: 0.4, repeat: 3, yoyo: true }, 0.8)
    .to([bg, txt, sub], { opacity: 0, duration: 0.5, delay: Math.max(dur - 2, 0.5) })
    .call(() => { container.innerHTML = ''; gsap.set(container, { display: 'none' }) })
}
