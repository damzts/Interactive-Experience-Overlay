import gsap from 'gsap'
import type { PersonaShiftConfig } from '@ieomlabs/shared'

/** PERSONA-SHIFT — color wash floods screen + bold mode label slams in. */
export function runPersonaShift(cfg: PersonaShiftConfig) {
  const container = document.getElementById('tl-persona-shift')
  if (!container) return

  const color   = cfg.color ?? '#00ff41'
  const holdDur = cfg.duration - 1.1

  gsap.set(container, { display: 'block' })
  container.innerHTML = ''

  const wash = document.createElement('div')
  wash.style.cssText = `position:absolute;inset:0;background:${color};opacity:0`

  const label = document.createElement('div')
  label.style.cssText = [
    'position:absolute', 'left:50%', 'top:50%',
    'transform:translate(-50%,-50%) scale(0.5)',
    'font-family:VT323,monospace', 'font-size:80px',
    'color:#000', 'letter-spacing:8px',
    'text-align:center', 'white-space:nowrap', 'opacity:0',
  ].join(';')
  label.textContent = cfg.label

  container.appendChild(wash)
  container.appendChild(label)

  gsap.timeline()
    .to(wash,  { opacity: 0.5, duration: 0.25, ease: 'power3.in' })
    .to(label, { opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(1.6)' }, '<0.1')
    .to(wash,  { opacity: 0.15, duration: 0.3 }, '<0.3')
    .to(label, { opacity: 0, scale: 1.1, duration: 0.35, ease: 'power2.in', delay: holdDur })
    .to(wash,  { opacity: 0, duration: 0.3 }, '<')
    .call(() => { container.innerHTML = ''; gsap.set(container, { display: 'none' }) })
}
