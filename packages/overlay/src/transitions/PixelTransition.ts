import gsap from 'gsap'
import type { PixelTransitionConfig } from '@ieomlabs/shared'

/** PIXEL-TRANSITION — grid of black tiles scatter in then scatter out. */
export function runPixelTransition(cfg: PixelTransitionConfig) {
  const container = document.getElementById('tl-pixel-grid')
  if (!container) return

  const px   = cfg.pixelSize ?? 20
  const cols = Math.ceil(1920 / px)
  const rows = Math.ceil(1080 / px)
  const n    = cols * rows

  gsap.set(container, { display: 'block' })
  container.innerHTML = ''

  const frag  = document.createDocumentFragment()
  const cells: HTMLElement[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement('div')
      cell.style.cssText = [
        'position:absolute',
        `left:${c * px}px`, `top:${r * px}px`,
        `width:${px}px`, `height:${px}px`,
        'background:#000', 'opacity:0',
      ].join(';')
      frag.appendChild(cell)
      cells.push(cell)
    }
  }
  container.appendChild(frag)

  const half = cfg.duration / 2
  // scatter in
  gsap.to(cells, { opacity: 1, duration: 0.08, stagger: { each: half / n, from: 'random' } })
  // scatter out
  gsap.to(cells, {
    opacity: 0, duration: 0.08,
    stagger: { each: half / n, from: 'random' },
    delay: half,
    onComplete: () => { gsap.set(container, { display: 'none' }); container.innerHTML = '' },
  })
}
