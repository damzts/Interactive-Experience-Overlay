import gsap from 'gsap'
import type { MatrixGlitchConfig } from '@ieomlabs/shared'

const GLYPHS = 'ｦｱｳｴｵｶｷｹｺｻｼｽｾｿﾀﾂﾃﾅﾆﾇﾈﾊﾋﾎﾏﾐﾑﾒﾓﾔﾕﾗﾘﾜ0123456789'

/** MATRIX-GLITCH — full-screen matrix-rain dissolve, fades in then out. */
export function runMatrixGlitch(cfg: MatrixGlitchConfig) {
  const container = document.getElementById('tl-matrix-glitch') as HTMLElement | null
  if (!container) return

  const color = cfg.color ?? '#00ff41'
  const dur   = cfg.duration ?? 2.5

  gsap.set(container, { display: 'block' })
  container.innerHTML = '<canvas id="tl-matrix-glitch-canvas" style="position:absolute;inset:0;width:100%;height:100%"></canvas>'

  const canvas = container.querySelector('#tl-matrix-glitch-canvas') as HTMLCanvasElement | null
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx) return

  const W = 1920, H = 1080
  canvas.width = W
  canvas.height = H
  const fontSize = 20
  const cols = Math.floor(W / fontSize)
  const drops = new Array(cols).fill(0).map(() => Math.random() * -H)

  let raf = 0
  const tick = () => {
    ctx.fillStyle = 'rgba(0,0,0,0.15)'
    ctx.fillRect(0, 0, W, H)
    ctx.font = `${fontSize}px monospace`
    ctx.fillStyle = color
    drops.forEach((y, i) => {
      const ch = GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
      ctx.fillText(ch, i * fontSize, y)
      drops[i] = y > H && Math.random() > 0.975 ? 0 : y + fontSize
    })
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)

  gsap.timeline()
    .to(container, { opacity: 1, duration: 0.2 })
    .to(container, { opacity: 0, duration: 0.4, delay: Math.max(dur - 0.6, 0.3) })
    .call(() => {
      cancelAnimationFrame(raf)
      container.innerHTML = ''
      gsap.set(container, { display: 'none' })
    })
}
