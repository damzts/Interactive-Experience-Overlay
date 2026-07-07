import gsap from 'gsap'
import type { HaloChargeConfig } from '@ieomlabs/shared'

/** HALO-CHARGE — Aero Saint. A glass ring spins up behind the alert, then
 *  detonates into a soft white-out bloom that fades to reveal the scene. */
export function runHaloCharge(cfg: HaloChargeConfig) {
  const container = document.getElementById('tl-halo-charge')
  if (!container) return

  const color = cfg.color ?? '#bfe9ff'
  const text  = cfg.text ?? ''
  const dur   = cfg.duration ?? 2.6

  gsap.set(container, { display: 'block' })
  container.innerHTML = `
    <div id="tl-halo-ring" style="
      position:absolute; left:50%; top:50%; width:60vmin; height:60vmin;
      transform:translate(-50%,-50%) scale(0.2) rotate(0deg); opacity:0;
      border-radius:50%;
      background:conic-gradient(from 0deg, transparent, ${color}, transparent 30%);
      filter:blur(2px);
    "></div>
    <div id="tl-halo-flash" style="
      position:absolute; inset:0; background:radial-gradient(circle at 50% 50%, #ffffff, ${color} 60%, transparent 100%);
      opacity:0;
    "></div>
    ${text ? `<div id="tl-halo-text" style="
      position:absolute; left:50%; top:64%; transform:translate(-50%,0); opacity:0;
      font-family:Tahoma,Segoe UI,Arial,sans-serif; font-weight:600; font-size:26px;
      color:#08374c; text-shadow:0 0 14px #ffffff; letter-spacing:1px;
    ">${text}</div>` : ''}
  `

  const ring  = container.querySelector('#tl-halo-ring')
  const flash = container.querySelector('#tl-halo-flash')
  const label = container.querySelector('#tl-halo-text')

  const tl = gsap.timeline()
  tl.to(ring, { opacity: 0.9, scale: 1, rotate: 220, duration: dur * 0.55, ease: 'power1.inOut' })
  if (label) tl.to(label, { opacity: 1, duration: 0.4 }, '<0.15')
  tl.to(flash, { opacity: 0.85, duration: 0.25, ease: 'power2.in' }, '>-0.1')
    .to(flash, { opacity: 0, duration: dur * 0.35, ease: 'power2.out' })
    .to(ring,  { opacity: 0, duration: 0.4 }, '<')
    .to(label, { opacity: 0, duration: 0.3 }, '<')
    .call(() => { container.innerHTML = ''; gsap.set(container, { display: 'none' }) })
}
