import gsap from 'gsap'
import type { CorruptionBurstConfig } from '@ieom/shared'

/** ARCHIVE_CORRUPTION overlay — glitch artifact burst. */

const INTENSITY_SCALE = { low: 0.5, medium: 1, high: 2 }

export function runArchiveCorruption(cfg: CorruptionBurstConfig) {
  const overlay  = document.getElementById('tl-corruption-overlay')
  const scanline = document.getElementById('tl-corruption-scanline')
  const root     = document.getElementById('overlay-root')
  if (!overlay || !scanline) return

  overlay.innerHTML = ''
  gsap.killTweensOf([overlay, scanline, root])

  const scale = INTENSITY_SCALE[cfg.intensity]
  const W = 1920
  const H = 1080
  const rectCount = Math.round(10 * scale + 8)

  const rects: HTMLElement[] = []
  for (let i = 0; i < rectCount; i++) {
    const r = document.createElement('div')
    const w = (40 + Math.random() * 400) * Math.min(scale * 0.8 + 0.5, 1.5)
    const h = (2 + Math.random() * 30) * scale
    r.style.cssText = [
      'position:absolute',
      `left:${Math.random() * (W - w)}px`,
      `top:${Math.random() * (H - h)}px`,
      `width:${w}px`,
      `height:${h}px`,
      `background:${randomGlitchColor()}`,
      'opacity:0',
      'mix-blend-mode:screen',
      'pointer-events:none',
    ].join(';')
    overlay.appendChild(r)
    rects.push(r)
  }

  const TEXT_FRAGS = ['█▓░▒', 'ERR', 'NULL', '0xDEAD', '▌▐░▒▓', 'DATA_CORRUPT', '??', '##']
  for (let i = 0; i < Math.round(4 * scale); i++) {
    const t = document.createElement('div')
    t.textContent = TEXT_FRAGS[Math.floor(Math.random() * TEXT_FRAGS.length)]
    t.style.cssText = [
      'position:absolute',
      `left:${Math.random() * (W - 200)}px`,
      `top:${Math.random() * (H - 40)}px`,
      'font-family:VT323,monospace',
      `font-size:${16 + Math.floor(Math.random() * 24)}px`,
      `color:${randomGlitchColor()}`,
      'opacity:0',
      'pointer-events:none',
      'mix-blend-mode:screen',
    ].join(';')
    overlay.appendChild(t)
    rects.push(t)
  }

  const tl = gsap.timeline()
  const d  = cfg.duration

  if (root && scale >= 1) {
    tl.to(root, { filter: 'blur(1px) hue-rotate(30deg) saturate(2)', duration: d * 0.04 })
      .to(root, { filter: 'none', duration: d * 0.04 }, `+=` + (d * 0.05))
      .to(root, { filter: `blur(${scale}px) hue-rotate(-40deg)`, duration: d * 0.03 }, `+=` + (d * 0.1))
      .to(root, { filter: 'none', duration: d * 0.1 })
  }

  const half = Math.floor(rects.length / 2)
  tl.to(rects.slice(0, half), { opacity: () => 0.3 + Math.random() * 0.6, duration: d * 0.04, stagger: d * 0.015 }, 0)
    .to(rects.slice(0, half), { opacity: 0, duration: d * 0.06, stagger: d * 0.015 }, `+=` + (d * 0.06))
    .to(rects.slice(half),    { opacity: () => 0.3 + Math.random() * 0.6, duration: d * 0.03, stagger: d * 0.01 }, `+=` + (d * 0.05))
    .to(rects,                { opacity: 0, duration: d * 0.1, stagger: d * 0.01 }, `+=` + (d * 0.1))

  tl.set(scanline, { opacity: 0.9, y: -20 }, 0)
    .to(scanline, { y: H + 20, duration: d * 0.4, ease: 'linear' }, 0)
    .to(scanline, { opacity: 0, duration: d * 0.1 }, `-=` + (d * 0.1))

  tl.to(rects, { opacity: () => Math.random() > 0.4 ? 0.2 + Math.random() * 0.5 : 0, duration: d * 0.04, stagger: d * 0.01 }, `+=` + (d * 0.15))
    .to(rects, { opacity: 0, duration: d * 0.2, stagger: d * 0.02, ease: 'power3.in' })

  tl.call(() => {
    overlay.innerHTML = ''
    gsap.set(scanline, { clearProps: 'all' })
    if (root) gsap.set(root, { clearProps: 'filter' })
  })
}

function randomGlitchColor(): string {
  const palette = [
    'rgba(255,0,80,0.85)',
    'rgba(0,255,180,0.75)',
    'rgba(180,0,255,0.8)',
    'rgba(255,200,0,0.7)',
    'rgba(0,150,255,0.8)',
    'rgba(255,255,255,0.6)',
  ]
  return palette[Math.floor(Math.random() * palette.length)]
}
