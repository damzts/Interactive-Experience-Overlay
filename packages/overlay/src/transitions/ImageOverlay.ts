import gsap from 'gsap'
import type { ImageOverlayConfig } from '@ieom/shared'

/** Displays a transparent image (PNG/APNG) as an overlay.
 *  Uses #tl-media-container. Position is absolute within 1920×1080. */
export function runImageOverlay(cfg: ImageOverlayConfig): void {
  const container = document.getElementById('tl-media-container')
  if (!container) return

  const img = document.createElement('img')
  img.src = cfg.src
  img.style.cssText = [
    'position: absolute',
    'opacity: 0',
    'pointer-events: none',
    cfg.width  != null ? `width:${cfg.width}px`   : '',
    cfg.height != null ? `height:${cfg.height}px` : '',
  ].filter(Boolean).join(';')

  container.appendChild(img)

  const place = () => {
    const iw = cfg.width  ?? img.naturalWidth  ?? 0
    const ih = cfg.height ?? img.naturalHeight ?? 0
    img.style.left = (cfg.x  != null ? cfg.x  : (1920 - iw) / 2) + 'px'
    img.style.top  = (cfg.y  != null ? cfg.y  : (1080 - ih) / 2) + 'px'
  }

  const show = () => {
    place()
    const dur  = Math.max(cfg.duration, 0.8)
    const hold = dur - 0.7
    gsap.timeline()
      .to(img, { opacity: cfg.opacity ?? 1, duration: 0.3, ease: 'power1.out' })
      .to(img, { opacity: 0, duration: 0.4, ease: 'power1.in',  delay: hold })
      .call(() => img.remove())
  }

  if (img.complete && img.naturalWidth > 0) {
    show()
  } else {
    img.onload  = show
    img.onerror = () => img.remove()
  }
}
