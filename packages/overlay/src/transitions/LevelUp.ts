import gsap from 'gsap'
import type { LevelUpConfig } from '@ieomlabs/shared'

/** LEVEL-UP — "LEVEL UP" text zooms in with an expanding ring shockwave. */
export function runLevelUp(cfg: LevelUpConfig) {
  const container = document.getElementById('tl-level-up')
  if (!container) return

  const color    = cfg.color ?? '#f5c400'
  const label    = cfg.text  ?? 'LEVEL UP'
  const levelStr = cfg.level != null ? `— LEVEL ${cfg.level} —` : ''

  gsap.set(container, { display: 'block' })

  const ring = document.createElement('div')
  ring.style.cssText = [
    'position:absolute', 'left:50%', 'top:50%',
    'width:240px', 'height:240px', 'border-radius:50%',
    `border:4px solid ${color}`,
    'transform:translate(-50%,-50%) scale(0)',
    `box-shadow:0 0 30px ${color}`,
    'opacity:1',
  ].join(';')
  container.appendChild(ring)

  const text = document.createElement('div')
  text.style.cssText = [
    'position:absolute', 'left:50%', 'top:50%',
    'transform:translate(-50%,-50%) scale(0)',
    'font-family:VT323,monospace',
    'text-align:center',
    'pointer-events:none',
    'white-space:nowrap',
  ].join(';')
  text.innerHTML = `
    <div style="font-size:80px;color:${color};text-shadow:0 0 40px ${color};letter-spacing:6px">${label}</div>
    ${levelStr ? `<div style="font-size:36px;color:#fff;letter-spacing:4px;margin-top:4px;text-shadow:0 0 14px #fff">${levelStr}</div>` : ''}
  `
  container.appendChild(text)

  const holdDur = Math.max(cfg.duration - 1.1, 0.5)

  gsap.timeline()
    .to(ring,  { scale: 10, opacity: 0, duration: 1.4, ease: 'power2.out' })
    .to(text,  { scale: 1, duration: 0.4, ease: 'back.out(1.6)' }, 0)
    .to(text,  { opacity: 0, scale: 1.08, duration: 0.4, ease: 'power2.in', delay: holdDur }, '>')
    .call(() => { container.innerHTML = ''; gsap.set(container, { display: 'none' }) })
}
