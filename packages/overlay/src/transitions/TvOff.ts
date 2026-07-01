import gsap from 'gsap'
import type { TvOffConfig } from '@ieomlabs/shared'

/** TV-OFF — CRT power-down: scaleY collapse → horizontal dot → black. */
export function runTvOff(cfg: TvOffConfig) {
  const container = document.getElementById('tl-tv-off')
  if (!container) return

  const dur  = cfg.duration ?? 1.2
  const root = document.getElementById('overlay-root')

  gsap.set(container, { display: 'block', background: '#000', opacity: 0 })
  container.innerHTML = ''

  const flash = document.createElement('div')
  flash.style.cssText = 'position:absolute;inset:0;background:#fff;opacity:0'
  container.appendChild(flash)

  const dot = document.createElement('div')
  dot.style.cssText = [
    'position:absolute', 'left:50%', 'top:50%',
    'width:100%', 'height:3px',
    'background:#fff',
    'transform:translate(-50%,-50%) scaleX(0)',
    'box-shadow:0 0 24px #fff, 0 0 60px #fff',
  ].join(';')
  container.appendChild(dot)

  gsap.timeline()
    .to(flash, { opacity: 0.9, duration: 0.05 })
    .to(flash, { opacity: 0, duration: 0.1 })
    .to(container, { opacity: 1, duration: 0.05 })
    .to(root, { scaleY: 0.015, duration: dur * 0.3, ease: 'power3.in' })
    .to(dot, { scaleX: 1, duration: 0.06 })
    .to(dot, { opacity: 0, scaleX: 0, duration: dur * 0.4, ease: 'power2.out' })
    .to(root, { scaleY: 1, duration: 0.01 })
    .to(container, { opacity: 0, duration: 0.2 })
    .call(() => { gsap.set(container, { display: 'none' }); container.innerHTML = '' })
}
