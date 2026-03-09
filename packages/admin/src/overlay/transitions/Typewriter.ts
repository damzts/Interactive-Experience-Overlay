import gsap from 'gsap'
import type { TypewriterConfig } from '@ieom/shared'

const POSITION_STYLE: Record<TypewriterConfig['position'], string> = {
  top:    'position:absolute;top:80px;left:50%;transform:translateX(-50%)',
  center: 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%)',
  bottom: 'position:absolute;bottom:120px;left:50%;transform:translateX(-50%)',
}

/** TYPEWRITER — text types itself character by character, then fades. */
export function runTypewriter(cfg: TypewriterConfig) {
  const container = document.getElementById('tl-typewriter-container')
  if (!container) return

  const el = document.createElement('div')
  el.style.cssText = [
    POSITION_STYLE[cfg.position],
    `font-family:VT323,monospace`,
    `font-size:${cfg.fontSize}px`,
    `color:${cfg.color}`,
    `text-shadow:0 0 10px ${cfg.color}`,
    'letter-spacing:3px',
    'text-align:center',
    'white-space:nowrap',
    'overflow:hidden',
    'max-width:1800px',
    'opacity:1',
  ].join(';')
  container.appendChild(el)

  const chars  = cfg.text.split('')
  const charMs = (cfg.duration * 800) / Math.max(chars.length, 1)
  const holdMs = cfg.duration * 200

  let i = 0
  const interval = setInterval(() => {
    el.textContent += chars[i++]
    if (i >= chars.length) {
      clearInterval(interval)
      setTimeout(() => {
        gsap.to(el, { opacity: 0, duration: 0.6, ease: 'power2.in', onComplete: () => el.remove() })
      }, holdMs)
    }
  }, charMs)
}
