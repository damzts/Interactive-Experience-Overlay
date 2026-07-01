import gsap from 'gsap'
import type { SweatDropConfig } from '@ieomlabs/shared'

const SIZES: Record<string, { drop: number; splash: number }> = {
  sm: { drop: 60,  splash: 20 },
  md: { drop: 100, splash: 32 },
  lg: { drop: 150, splash: 48 },
}

/** SWEAT-DROP — Giant anime sweat drop slides from top-right, wobbles, splash. */
export function runSweatDrop(cfg: SweatDropConfig) {
  const container = document.getElementById('tl-sweat-drop')
  if (!container) return

  const sz = SIZES[cfg.size ?? 'md']
  const holdMs = cfg.durationMs ?? 3000

  gsap.set(container, { display: 'block' })
  container.innerHTML = ''

  // The teardrop: CSS clip-path or SVG
  const drop = document.createElement('div')
  drop.style.cssText = [
    `width:${sz.drop}px`,
    `height:${sz.drop * 1.5}px`,
    'position:relative',
    'display:flex', 'flex-direction:column', 'align-items:center',
    'opacity:0',
    `transform:translateY(-${sz.drop * 2}px)`,
  ].join(';')

  // Tear shape via SVG
  drop.innerHTML = `
    <svg width="${sz.drop}" height="${sz.drop * 1.5}" viewBox="0 0 100 150">
      <path d="M50 0 C50 0 10 60 10 95 A40 40 0 0 0 90 95 C90 60 50 0 50 0 Z"
        fill="#99ccff" stroke="#6699cc" stroke-width="2" opacity="0.9"/>
      <ellipse cx="38" cy="78" rx="12" ry="8" fill="rgba(255,255,255,0.4)"/>
    </svg>
  `
  container.appendChild(drop)

  // Splash droplets (hidden initially)
  const splashContainer = document.createElement('div')
  splashContainer.style.cssText = `position:relative;width:${sz.drop}px;height:${sz.splash}px;display:none`
  const splashAngles = [-40, -20, 0, 20, 40]
  splashAngles.forEach(angle => {
    const d = document.createElement('div')
    d.style.cssText = [
      'position:absolute',
      `left:${sz.drop / 2 + Math.sin(angle * Math.PI / 180) * sz.splash * 0.8 - 3}px`,
      'top:0',
      'width:5px', 'height:10px',
      'background:#99ccff',
      'border-radius:50% 50% 40% 40%',
      `transform:rotate(${angle}deg)`,
      'transform-origin:50% 100%',
    ].join(';')
    splashContainer.appendChild(d)
  })
  container.appendChild(splashContainer)

  const holdSec = holdMs / 1000 - 0.7

  gsap.timeline()
    // Drop slides in
    .to(drop, { opacity: 1, y: 0, duration: 0.6, ease: 'bounce.out' })
    // Wobble
    .to(drop, { scaleX: 1.15, scaleY: 0.85, duration: 0.12, ease: 'power2.out', transformOrigin: '50% 100%' })
    .to(drop, { scaleX: 0.9, scaleY: 1.1, duration: 0.1, ease: 'power2.inOut' })
    .to(drop, { scaleX: 1, scaleY: 1, duration: 0.2 })
    // Splash
    .call(() => {
      drop.style.display = 'none'
      splashContainer.style.display = 'block'
      gsap.from(splashContainer.children, { scaleY: 0, opacity: 0, duration: 0.2, stagger: 0.03, transformOrigin: '50% 100%' })
    })
    .to(splashContainer, { opacity: 0, duration: 0.3, delay: holdSec })
    .call(() => { container.innerHTML = ''; gsap.set(container, { display: 'none' }) })
}
