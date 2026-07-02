import gsap from 'gsap'
import type { BossWarningConfig } from '@ieomlabs/shared'

/** BOSS-WARNING — Metal Gear-style "!" alert: red flash + warning banner. */
export function runBossWarning(cfg: BossWarningConfig) {
  const container = document.getElementById('tl-boss-warning')
  if (!container) return

  const text = cfg.text ?? 'WARNING'
  const dur  = cfg.duration ?? 3

  gsap.set(container, { display: 'block' })
  container.innerHTML = `
    <div id="tl-boss-vignette" style="position:absolute;inset:0;box-shadow:inset 0 0 200px 40px #ff000000"></div>
    <div id="tl-boss-mark" style="
      position:absolute; left:50%; top:38%; transform:translate(-50%,-50%) scale(0);
      font-family:'Press Start 2P',VT323,monospace; font-size:110px; color:#ff2222;
      text-shadow:0 0 40px #ff0000;
    ">!</div>
    <div id="tl-boss-text" style="
      position:absolute; left:50%; top:60%; transform:translate(-50%,-50%); opacity:0;
      font-family:VT323,monospace; font-size:40px; letter-spacing:8px; color:#ff4444;
      text-shadow:0 0 16px #ff0000;
    ">${text}</div>
  `

  const vignette = container.querySelector('#tl-boss-vignette') as HTMLElement
  const mark = container.querySelector('#tl-boss-mark')
  const txt  = container.querySelector('#tl-boss-text')

  const flashTl = gsap.timeline({ repeat: 3, yoyo: true })
    .to(vignette, { boxShadow: 'inset 0 0 260px 60px #ff0000aa', duration: 0.25 })

  gsap.timeline()
    .to(mark, { scale: 1, duration: 0.25, ease: 'back.out(3)' })
    .to(txt,  { opacity: 1, duration: 0.2 }, '<')
    .add(flashTl, 0)
    .to([mark, txt], { opacity: 0, duration: 0.3, delay: Math.max(dur - 1.5, 0.5) })
    .call(() => { container.innerHTML = ''; gsap.set(container, { display: 'none' }) })
}
