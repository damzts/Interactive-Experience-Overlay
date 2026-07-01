import gsap from 'gsap'
import type { SpotlightConfig } from '@ieomlabs/shared'

/** SPOTLIGHT — dark radial mask with a bright moving circle in the center. */
export function runSpotlight(cfg: SpotlightConfig) {
  const container = document.getElementById('tl-spotlight')
  if (!container) return

  const radius = cfg.radius ?? 280
  const color  = cfg.color  ?? 'rgba(255,255,220,0.15)'
  const fade   = Math.min(cfg.duration * 0.2, 0.5)
  const hold   = cfg.duration - fade * 2

  gsap.set(container, { display: 'block', opacity: 0 })
  container.innerHTML = ''

  const mask = document.createElement('div')
  mask.style.cssText = [
    'position:absolute', 'inset:0',
    `background:radial-gradient(circle ${radius}px at 50% 50%, transparent 0%, rgba(0,0,0,0.85) 100%)`,
  ].join(';')
  container.appendChild(mask)

  const light = document.createElement('div')
  light.style.cssText = [
    'position:absolute',
    `width:${radius * 2}px`, `height:${radius * 2}px`,
    'border-radius:50%',
    `background:radial-gradient(circle, ${color} 0%, transparent 70%)`,
    'left:50%', 'top:50%',
    `transform:translate(-50%, -50%)`,
    'pointer-events:none',
  ].join(';')
  container.appendChild(light)

  // Slow drift of the light
  gsap.to(light, { x: 60, y: -40, duration: hold * 0.5, ease: 'sine.inOut', yoyo: true, repeat: 1 })

  gsap.timeline()
    .to(container, { opacity: 1, duration: fade, ease: 'power2.in' })
    .to(container, { opacity: 0, duration: fade, ease: 'power2.out', delay: hold })
    .call(() => { container.innerHTML = ''; gsap.set(container, { display: 'none' }) })
}
