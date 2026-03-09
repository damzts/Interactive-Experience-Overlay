import gsap from 'gsap'
import type { VideoOverlayConfig } from '@ieom/shared'

/** Displays a video as an overlay (WebM with alpha channel = transparent).
 *  Uses #tl-media-container. Position is absolute within 1920×1080. */
export function runVideoOverlay(cfg: VideoOverlayConfig): void {
  const container = document.getElementById('tl-media-container')
  if (!container) return

  const video = document.createElement('video')
  video.src         = cfg.src
  video.muted       = true        // Required for autoplay in browsers
  video.loop        = cfg.loop ?? false
  video.playsInline = true
  video.style.cssText = [
    'position: absolute',
    'opacity: 0',
    'pointer-events: none',
    cfg.width  != null ? `width:${cfg.width}px`   : '',
    cfg.height != null ? `height:${cfg.height}px` : '',
  ].filter(Boolean).join(';')

  container.appendChild(video)

  video.onloadedmetadata = () => {
    const vw  = cfg.width  ?? video.videoWidth
    const vh  = cfg.height ?? video.videoHeight
    video.style.left = (cfg.x != null ? cfg.x : (1920 - vw) / 2) + 'px'
    video.style.top  = (cfg.y != null ? cfg.y : (1080 - vh) / 2) + 'px'

    const dur  = cfg.duration > 0 ? cfg.duration : video.duration ?? 3
    const hold = Math.max(dur - 0.7, 0.1)

    video.play().catch(() => { /* autoplay blocked — clean up */ video.remove() })

    gsap.timeline()
      .to(video, { opacity: cfg.opacity ?? 1, duration: 0.3, ease: 'power1.out' })
      .to(video, { opacity: 0, duration: 0.4, ease: 'power1.in', delay: hold })
      .call(() => { video.pause(); video.remove() })
  }

  video.onerror = () => video.remove()
  video.load()
}
