import gsap from 'gsap'
import type { ChapterRevealConfig } from '@ieomlabs/shared'

/** CHAPTER-REVEAL — full-screen elegant title card with chapter number + title. */
export function runChapterReveal(cfg: ChapterRevealConfig) {
  const container = document.getElementById('tl-chapter-reveal')
  if (!container) return

  const holdDur = cfg.duration - 1.2

  gsap.set(container, { display: 'block' })
  container.innerHTML = ''

  // Dark background
  const bg = document.createElement('div')
  bg.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,0.88);opacity:0'
  container.appendChild(bg)

  // Horizontal line accents
  const lineTop = document.createElement('div')
  lineTop.style.cssText = 'position:absolute;left:10%;width:0%;top:calc(50% - 60px);height:1px;background:#ffffff44'
  const lineBot = document.createElement('div')
  lineBot.style.cssText = 'position:absolute;left:10%;width:0%;top:calc(50% + 60px);height:1px;background:#ffffff44'

  // Content
  const content = document.createElement('div')
  content.style.cssText = [
    'position:absolute', 'left:50%', 'top:50%',
    'transform:translate(-50%,-50%)',
    'text-align:center', 'opacity:0',
    'font-family:VT323,monospace',
  ].join(';')

  const numHtml = cfg.number != null
    ? `<div style="font-size:20px;color:#888;letter-spacing:8px;text-transform:uppercase;margin-bottom:8px">Chapter ${cfg.number}</div>`
    : ''
  const subHtml = cfg.subtitle
    ? `<div style="font-size:28px;color:#aaa;letter-spacing:4px;margin-top:8px">${cfg.subtitle}</div>`
    : ''
  content.innerHTML = `
    ${numHtml}
    <div style="font-size:72px;color:#fff;letter-spacing:6px;text-shadow:0 0 30px rgba(255,255,255,0.3)">${cfg.title}</div>
    ${subHtml}
  `
  container.appendChild(bg)
  container.appendChild(lineTop)
  container.appendChild(lineBot)
  container.appendChild(content)

  gsap.timeline()
    .to(bg, { opacity: 1, duration: 0.3 })
    .to([lineTop, lineBot], { width: '80%', duration: 0.6, ease: 'power2.out' }, '<0.1')
    .to(content, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }, '<0.2')
    .to(content, { opacity: 0, duration: 0.4, ease: 'power2.in', delay: holdDur })
    .to([lineTop, lineBot], { width: 0, duration: 0.3, ease: 'power2.in' }, '<')
    .to(bg, { opacity: 0, duration: 0.3 }, '<0.1')
    .call(() => { container.innerHTML = ''; gsap.set(container, { display: 'none' }) })
}
