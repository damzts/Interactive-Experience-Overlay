import gsap from 'gsap'
import type { ChatBubbleConfig } from '@ieomlabs/shared'

const POSITION_Y: Record<string, string> = {
  top:    'top:120px',
  center: 'top:50%;transform:translateX(-50%) translateY(-50%)',
  bottom: 'bottom:140px',
}

/** CHAT-BUBBLE — a pinned speech bubble with text and optional author label. */
export function runChatBubble(cfg: ChatBubbleConfig) {
  const container = document.getElementById('tl-chat-bubble')
  if (!container) return

  const pos = cfg.position ?? 'bottom'

  gsap.set(container, { display: 'block' })
  container.innerHTML = ''

  const bubble = document.createElement('div')
  bubble.style.cssText = [
    'position:absolute',
    'left:50%',
    pos === 'center' ? '' : 'transform:translateX(-50%)',
    POSITION_Y[pos] ?? POSITION_Y.bottom,
    'background:rgba(10,10,20,0.92)',
    'border:2px solid #4488ff',
    'border-radius:4px',
    'padding:14px 22px',
    'max-width:700px',
    'font-family:VT323,monospace',
    'opacity:0', 'pointer-events:none',
  ].join(';')

  const authorHtml = cfg.author
    ? `<div style="font-size:16px;color:#4488ff;letter-spacing:2px;margin-bottom:6px">${cfg.author}</div>`
    : ''

  bubble.innerHTML = `
    ${authorHtml}
    <div style="font-size:26px;color:#fff;letter-spacing:1px;line-height:1.35">${cfg.text}</div>
  `

  // Tail triangle (pointing down for bottom position)
  if (pos === 'bottom') {
    const tail = document.createElement('div')
    tail.style.cssText = [
      'position:absolute', 'left:50%', 'bottom:-12px',
      'transform:translateX(-50%)',
      'width:0', 'height:0',
      'border-left:10px solid transparent',
      'border-right:10px solid transparent',
      'border-top:12px solid #4488ff',
    ].join(';')
    bubble.appendChild(tail)
  }

  container.appendChild(bubble)

  const hold = cfg.duration - 0.7
  gsap.timeline()
    .to(bubble, { opacity: 1, y: pos === 'bottom' ? -12 : 0, duration: 0.3, ease: 'back.out(1.4)' })
    .to(bubble, { opacity: 0, y: pos === 'bottom' ? -24 : 12, duration: 0.35, ease: 'power2.in', delay: hold })
    .call(() => { container.innerHTML = ''; gsap.set(container, { display: 'none' }) })
}
