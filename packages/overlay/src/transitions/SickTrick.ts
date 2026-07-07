import gsap from 'gsap'
import type { SickTrickConfig } from '@ieomlabs/shared'

/** SICK-TRICK — Trick City. A diagonal spray-streak wipe crosses the screen
 *  while a chunky combo-style callout racks up a score number. */
export function runSickTrick(cfg: SickTrickConfig) {
  const container = document.getElementById('tl-sick-trick')
  if (!container) return

  const label = cfg.comboLabel ?? 'SICK TRICK!'
  const score = Math.max(0, Math.round(cfg.score ?? 5000))
  const dur   = cfg.duration ?? 2.2

  gsap.set(container, { display: 'block' })
  container.innerHTML = `
    <div id="tl-trick-streak" style="
      position:absolute; inset:-20% -20%; opacity:0;
      background:repeating-linear-gradient(115deg, rgba(255,107,53,0.55) 0 8px, transparent 8px 22px, rgba(46,230,214,0.4) 22px 30px, transparent 30px 46px);
      mix-blend-mode:screen;
    "></div>
    <div id="tl-trick-text" style="
      position:absolute; left:50%; top:44%; transform:translate(-50%,-50%) scale(0.5) skewX(-8deg); opacity:0;
      font-family:Rajdhani,sans-serif; font-weight:800; font-size:64px; letter-spacing:2px;
      color:#ff6b35; text-shadow:0 0 24px #ff6b35, 3px 3px 0 #1c1c22;
      white-space:nowrap;
    ">${label}</div>
    <div id="tl-trick-score" style="
      position:absolute; left:50%; top:60%; transform:translate(-50%,0); opacity:0;
      font-family:Rajdhani,sans-serif; font-weight:700; font-size:34px; letter-spacing:4px;
      color:#2ee6d6; text-shadow:0 0 14px #2ee6d6;
    ">0</div>
  `

  const streak = container.querySelector('#tl-trick-streak')
  const text   = container.querySelector('#tl-trick-text')
  const scoreEl = container.querySelector('#tl-trick-score') as HTMLElement | null
  const counter = { n: 0 }

  gsap.timeline()
    .to(streak, { opacity: 1, duration: 0.15 })
    .to(streak, { x: '18%', duration: dur * 0.75, ease: 'power1.inOut' }, '<')
    .to(text,   { scale: 1, skewX: 0, opacity: 1, duration: 0.35, ease: 'back.out(2)' }, '<0.05')
    .to(scoreEl, { opacity: 1, duration: 0.2 }, '<0.1')
    .to(counter, {
      n: score, duration: Math.max(dur * 0.5, 0.4), ease: 'power2.out', roundProps: 'n',
      onUpdate: () => { if (scoreEl) scoreEl.textContent = counter.n.toLocaleString() },
    }, '<')
    .to([streak, text, scoreEl], { opacity: 0, duration: 0.35, delay: Math.max(dur * 0.15, 0.15) })
    .call(() => { container.innerHTML = ''; gsap.set(container, { display: 'none' }) })
}
