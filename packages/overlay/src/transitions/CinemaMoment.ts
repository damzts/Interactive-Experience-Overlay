import gsap from 'gsap'
import type { CinemaMomentConfig } from '@ieomlabs/shared'

/** CINEMA-MOMENT — letterbox bars slide in + deep vignette + dramatic text.
 *  Marks a gaming highlight as a cinematic event. */
export function runCinemaMoment(cfg: CinemaMomentConfig) {
  const container = document.getElementById('tl-cinema-moment')
  if (!container) return

  const color   = cfg.color ?? '#ffffff'
  const barH    = 90  // px
  const holdDur = cfg.duration - 1.0

  gsap.set(container, { display: 'block' })
  container.innerHTML = ''

  const topBar = document.createElement('div')
  topBar.style.cssText = `position:absolute;left:0;top:0;width:100%;height:${barH}px;background:#000;transform:translateY(-${barH}px)`

  const botBar = document.createElement('div')
  botBar.style.cssText = `position:absolute;left:0;bottom:0;width:100%;height:${barH}px;background:#000;transform:translateY(${barH}px)`

  const vignette = document.createElement('div')
  vignette.style.cssText = `position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 40%,rgba(0,0,0,0.7) 100%);opacity:0`

  container.appendChild(topBar)
  container.appendChild(botBar)
  container.appendChild(vignette)

  let textEl: HTMLElement | null = null
  if (cfg.text) {
    textEl = document.createElement('div')
    textEl.style.cssText = [
      'position:absolute', 'left:50%', 'top:50%',
      'transform:translate(-50%,-50%)',
      'font-family:VT323,monospace',
      'font-size:72px',
      `color:${color}`,
      `text-shadow:0 0 40px ${color}`,
      'letter-spacing:10px',
      'text-align:center',
      'white-space:nowrap',
      'opacity:0',
    ].join(';')
    textEl.textContent = cfg.text
    container.appendChild(textEl)
  }

  gsap.timeline()
    .to([topBar, botBar], { y: 0, duration: 0.5, ease: 'power3.out' })
    .to(vignette, { opacity: 1, duration: 0.4 }, '<')
    .to(textEl, { opacity: 1, duration: 0.5, ease: 'power2.out' }, '+=0.1')
    .to(textEl, { opacity: 0, duration: 0.4, ease: 'power2.in', delay: holdDur - 0.5 })
    .to([topBar, botBar, vignette], { opacity: 0, duration: 0.4, ease: 'power2.in' })
    .call(() => { container.innerHTML = ''; gsap.set(container, { display: 'none' }) })
}
