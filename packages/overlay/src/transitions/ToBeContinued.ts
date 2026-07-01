import gsap from 'gsap'
import type { ToBeContinuedConfig } from '@ieomlabs/shared'

let tbcStyleInjected = false

/** TO-BE-CONTINUED — JoJo's sepia wipe + "→ To Be Continued..." slide text. */
export function runToBeContinued(cfg: ToBeContinuedConfig) {
  const container = document.getElementById('tl-to-be-continued')
  if (!container) return

  const duration = cfg.duration ?? 4

  if (!tbcStyleInjected) {
    tbcStyleInjected = true
    const s = document.createElement('style')
    s.textContent = `
      @keyframes tbc-flicker { 0%,100%{opacity:1} 50%{opacity:0.92} }
      .tbc-text { animation: tbc-flicker 0.08s linear infinite; }
    `
    document.head.appendChild(s)
  }

  gsap.set(container, { display: 'block' })
  container.innerHTML = ''

  // Sepia overlay
  const sepia = document.createElement('div')
  sepia.style.cssText = [
    'position:absolute', 'inset:0',
    'background:rgba(101,74,40,0.55)',
    'mix-blend-mode:multiply',
    'opacity:0',
  ].join(';')
  container.appendChild(sepia)

  // Brown/orange gradient overlay for warmth
  const warm = document.createElement('div')
  warm.style.cssText = [
    'position:absolute', 'inset:0',
    'background:radial-gradient(ellipse at center,rgba(200,150,80,0.15) 0%,rgba(80,50,20,0.4) 100%)',
    'opacity:0',
  ].join(';')
  container.appendChild(warm)

  // "→ To Be Continued..." text
  const text = document.createElement('div')
  text.className = 'tbc-text'
  text.style.cssText = [
    'position:absolute', 'bottom:160px', 'left:-600px',
    'font-family:"Impact","Arial Black",sans-serif',
    'font-size:72px',
    'color:#f5a623',
    'text-shadow:-3px -3px 0 #5a3a00,3px -3px 0 #5a3a00,-3px 3px 0 #5a3a00,3px 3px 0 #5a3a00',
    'letter-spacing:3px',
    'white-space:nowrap',
  ].join(';')
  text.textContent = '→ To Be Continued...'
  container.appendChild(text)

  // Arrow underline
  const arrow = document.createElement('div')
  arrow.style.cssText = [
    'position:absolute', 'bottom:148px', 'left:-600px',
    'height:5px', 'width:600px',
    'background:#f5a623',
    'box-shadow:0 0 12px #f5a62388',
  ].join(';')
  container.appendChild(arrow)

  const holdSec = duration - 0.9

  gsap.timeline()
    .to([sepia, warm], { opacity: 1, duration: 0.5, ease: 'power2.inOut' })
    .to([text, arrow], { left: 80, duration: 0.5, ease: 'power3.out' }, '<0.15')
    .to([sepia, warm, text, arrow], { opacity: 0, duration: 0.4, delay: holdSec })
    .call(() => { container.innerHTML = ''; gsap.set(container, { display: 'none' }) })
}
