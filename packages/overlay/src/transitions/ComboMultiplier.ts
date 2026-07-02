import gsap from 'gsap'
import type { ComboMultiplierConfig } from '@ieomlabs/shared'

/** COMBO-MULTIPLIER — fighting-game style combo counter slams up to the target count. */
export function runComboMultiplier(cfg: ComboMultiplierConfig) {
  const container = document.getElementById('tl-combo-multiplier')
  if (!container) return

  const target = Math.max(1, Math.round(cfg.count ?? 8))
  const durMs  = cfg.durationMs ?? 2200

  gsap.set(container, { display: 'block' })
  container.innerHTML = `
    <div id="tl-combo-num" style="
      position:absolute; left:50%; top:50%; transform:translate(-50%,-50%) scale(0.4) rotate(-8deg);
      font-family:VT323,monospace; font-size:140px; font-weight:bold; color:#ffd94a;
      text-shadow:0 0 30px #ff9f43; opacity:0;
    ">0</div>
    <div id="tl-combo-label" style="
      position:absolute; left:50%; top:68%; transform:translate(-50%,0); opacity:0;
      font-family:VT323,monospace; font-size:30px; letter-spacing:6px; color:#ff9f43;
    ">HIT COMBO</div>
  `
  const num   = container.querySelector('#tl-combo-num') as HTMLElement
  const label = container.querySelector('#tl-combo-label')

  const counter = { n: 0 }
  const stepMs = Math.max(30, Math.min(120, (durMs * 0.6) / target))

  gsap.timeline()
    .to(num,   { opacity: 1, duration: 0.15 })
    .to(label, { opacity: 1, duration: 0.15 }, '<')
    .to(counter, {
      n: target, duration: (stepMs * target) / 1000, ease: 'none', roundProps: 'n',
      onUpdate: () => { num.textContent = String(counter.n) },
    })
    .to(num, { scale: 1.15, rotate: 4, duration: 0.12, ease: 'back.out(3)' })
    .to([num, label], { opacity: 0, duration: 0.3, delay: Math.max(durMs / 1000 - (stepMs * target) / 1000 - 0.8, 0.3) })
    .call(() => { container.innerHTML = ''; gsap.set(container, { display: 'none' }) })
}
