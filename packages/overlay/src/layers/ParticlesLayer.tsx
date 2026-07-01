import { useEffect, useRef } from 'react'
import type { OverlayParticles, ParticlePreset } from '@ieomlabs/shared'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  alpha: number
  // matrix specific
  char?: string
  charTimer?: number
  // firefly specific
  pulsePhase?: number
}

function initParticles(preset: ParticlePreset, count: number, w: number, h: number): Particle[] {
  const particles: Particle[] = []
  for (let i = 0; i < count; i++) {
    const p: Particle = {
      x: Math.random() * w,
      y: Math.random() * h,
      vx: 0,
      vy: 0,
      size: 1,
      alpha: Math.random(),
    }
    switch (preset) {
      case 'stars':
        p.size = Math.random() * 2 + 0.5
        p.vx = 0
        p.vy = 0
        p.alpha = Math.random() * 0.8 + 0.2
        break
      case 'snow':
        p.size = Math.random() * 3 + 1
        p.vx = (Math.random() - 0.5) * 0.4
        p.vy = Math.random() * 0.8 + 0.3
        p.alpha = Math.random() * 0.7 + 0.3
        break
      case 'matrix':
        p.char = String.fromCharCode(0x30a0 + Math.floor(Math.random() * 96))
        p.size = 14
        p.vy = Math.random() * 2 + 0.5
        p.alpha = Math.random() * 0.9 + 0.1
        p.charTimer = Math.random() * 60
        break
      case 'fireflies':
        p.size = Math.random() * 3 + 1
        p.vx = (Math.random() - 0.5) * 0.6
        p.vy = (Math.random() - 0.5) * 0.4
        p.alpha = Math.random()
        p.pulsePhase = Math.random() * Math.PI * 2
        break
      case 'ash':
        p.size = Math.random() * 2 + 0.5
        p.vx = (Math.random() - 0.5) * 0.6 - 0.3
        p.vy = Math.random() * 0.5 + 0.1
        p.alpha = Math.random() * 0.5 + 0.1
        break
      case 'rain':
        p.size = 1 + Math.random() * 2
        p.vx = (Math.random() - 0.5) * 0.8
        p.vy = 8 + Math.random() * 7
        p.alpha = 0.4 + Math.random() * 0.5
        break
      case 'embers':
        p.size = 1 + Math.random() * 2.5
        p.vx = (Math.random() - 0.5) * 0.6
        p.vy = -(0.5 + Math.random() * 1.5)
        p.alpha = Math.random() * 0.7 + 0.3
        p.pulsePhase = Math.random() * Math.PI * 2
        break
      case 'sakura':
        p.size = 3 + Math.random() * 5
        p.vx = (Math.random() - 0.5) * 0.3
        p.vy = 0.4 + Math.random() * 0.8
        p.alpha = 0.5 + Math.random() * 0.5
        p.pulsePhase = Math.random() * Math.PI * 2
        break
      case 'hearts':
        p.char = '♥'
        p.size = 16 + Math.random() * 10
        p.vx = (Math.random() - 0.5) * 0.5
        p.vy = -(0.6 + Math.random() * 0.9)
        p.alpha = 0.6 + Math.random() * 0.4
        break
      case 'hex':
        p.char = Math.floor(Math.random() * 256).toString(16).toUpperCase().padStart(2, '0')
        p.size = 13
        p.vy = Math.random() * 2 + 0.5
        p.alpha = Math.random() * 0.9 + 0.1
        p.charTimer = Math.random() * 60
        break
      case 'bubbles':
        p.size = 4 + Math.random() * 12
        p.vx = (Math.random() - 0.5) * 0.4
        p.vy = -(0.3 + Math.random() * 0.5)
        p.alpha = 0.2 + Math.random() * 0.4
        p.pulsePhase = Math.random() * Math.PI * 2
        break
      case 'kanji':
        p.char = String.fromCharCode(0x4e00 + Math.floor(Math.random() * 0x2000))
        p.size = 16
        p.vy = Math.random() * 2 + 0.5
        p.alpha = Math.random() * 0.85 + 0.15
        p.charTimer = Math.random() * 80
        break
      case 'aura':
        p.size = 2 + Math.random() * 4
        p.vx = (Math.random() - 0.5) * 0.8
        p.vy = -(1.5 + Math.random() * 3)
        p.alpha = 0.5 + Math.random() * 0.5
        p.pulsePhase = Math.random() * Math.PI * 2
        break
      case 'sparkle':
        p.size = 4 + Math.random() * 8
        p.vx = (Math.random() - 0.5) * 0.5
        p.vy = (Math.random() - 0.5) * 0.5
        p.alpha = Math.random()
        p.pulsePhase = Math.random() * Math.PI * 2
        break
      case 'dandelion':
        p.size = 1 + Math.random() * 2
        p.vx = (Math.random() - 0.5) * 0.3
        p.vy = -(0.2 + Math.random() * 0.5)
        p.alpha = 0.4 + Math.random() * 0.5
        p.pulsePhase = Math.random() * Math.PI * 2
        break
      case 'code-rain': {
        const words = ['null','404','err','0x','void','NaN','if()','[];','true','false','sudo']
        p.char = words[Math.floor(Math.random() * words.length)]
        p.size = 12
        p.vy = Math.random() * 2 + 0.5
        p.alpha = Math.random() * 0.85 + 0.15
        p.charTimer = Math.random() * 60
        break
      }
    }
    particles.push(p)
  }
  return particles
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  preset: ParticlePreset,
  speed: number,
  w: number,
  h: number,
  frame: number,
) {
  ctx.clearRect(0, 0, w, h)

  for (const p of particles) {
    switch (preset) {
      case 'stars': {
        // twinkle
        const twinkle = Math.sin(frame * 0.02 + p.alpha * 10) * 0.3 + 0.7
        ctx.globalAlpha = p.alpha * twinkle
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
        break
      }
      case 'snow': {
        ctx.globalAlpha = p.alpha
        ctx.fillStyle = '#e0f0ff'
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
        p.x += p.vx * speed * 60
        p.y += p.vy * speed * 60
        if (p.y > h + 10) { p.y = -10; p.x = Math.random() * w }
        if (p.x < -10) p.x = w + 10
        if (p.x > w + 10) p.x = -10
        break
      }
      case 'matrix': {
        ctx.globalAlpha = p.alpha
        ctx.fillStyle = '#00ff41'
        ctx.font = `${p.size}px monospace`
        ctx.fillText(p.char ?? '0', p.x, p.y)
        p.y += p.vy * speed * 60
        p.charTimer = (p.charTimer ?? 0) + 1
        if ((p.charTimer ?? 0) > 20 + Math.random() * 40) {
          p.char = String.fromCharCode(0x30a0 + Math.floor(Math.random() * 96))
          p.charTimer = 0
        }
        if (p.y > h + 20) { p.y = -20; p.x = Math.random() * w }
        break
      }
      case 'fireflies': {
        p.pulsePhase = (p.pulsePhase ?? 0) + 0.03
        const glow = Math.sin(p.pulsePhase) * 0.4 + 0.6
        ctx.globalAlpha = p.alpha * glow
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3)
        gradient.addColorStop(0, 'rgba(180,255,120,0.9)')
        gradient.addColorStop(1, 'rgba(100,255,80,0)')
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2)
        ctx.fill()
        p.x += p.vx * speed * 60
        p.y += p.vy * speed * 60
        // gentle drift
        p.vx += (Math.random() - 0.5) * 0.02
        p.vy += (Math.random() - 0.5) * 0.02
        p.vx = Math.max(-1, Math.min(1, p.vx))
        p.vy = Math.max(-1, Math.min(1, p.vy))
        if (p.x < 0 || p.x > w) p.vx *= -1
        if (p.y < 0 || p.y > h) p.vy *= -1
        break
      }
      case 'ash': {
        ctx.globalAlpha = p.alpha
        ctx.fillStyle = '#aaaaaa'
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
        p.x += p.vx * speed * 60
        p.y += p.vy * speed * 60
        if (p.y > h + 10) { p.y = -10; p.x = Math.random() * w }
        if (p.x < -10) p.x = w + 10
        if (p.x > w + 10) p.x = -10
        break
      }
      case 'rain': {
        ctx.globalAlpha = p.alpha
        ctx.strokeStyle = '#8899bb'
        ctx.lineWidth = p.size
        ctx.beginPath()
        ctx.moveTo(p.x, p.y)
        ctx.lineTo(p.x + p.vx * 2, p.y + p.size * 6)
        ctx.stroke()
        p.x += p.vx * speed * 60
        p.y += p.vy * speed * 60
        if (p.y > h + 20) { p.y = -20; p.x = Math.random() * w }
        break
      }
      case 'embers': {
        p.pulsePhase = (p.pulsePhase ?? 0) + 0.05
        const glow = Math.sin(p.pulsePhase) * 0.3 + 0.7
        ctx.globalAlpha = p.alpha * glow
        ctx.fillStyle = '#ff6622'
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
        p.x += p.vx * speed * 60
        p.y += p.vy * speed * 60
        p.vx += (Math.random() - 0.5) * 0.03
        if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w }
        break
      }
      case 'sakura': {
        p.pulsePhase = (p.pulsePhase ?? 0) + 0.015
        p.vx = Math.sin(p.pulsePhase) * 0.5
        ctx.globalAlpha = p.alpha
        ctx.fillStyle = '#ffb7c5'
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
        p.x += p.vx * speed * 60
        p.y += p.vy * speed * 60
        if (p.y > h + 20) { p.y = -20; p.x = Math.random() * w }
        break
      }
      case 'hearts': {
        ctx.globalAlpha = p.alpha
        ctx.fillStyle = '#ff4477'
        ctx.font = `${p.size}px serif`
        ctx.fillText(p.char ?? '♥', p.x, p.y)
        p.x += p.vx * speed * 60
        p.y += p.vy * speed * 60
        if (p.y < -30) { p.y = h + 20; p.x = Math.random() * w }
        break
      }
      case 'hex': {
        ctx.globalAlpha = p.alpha
        ctx.fillStyle = '#00ffcc'
        ctx.font = `${p.size}px monospace`
        ctx.fillText(p.char ?? '00', p.x, p.y)
        p.y += p.vy * speed * 60
        p.charTimer = (p.charTimer ?? 0) + 1
        if ((p.charTimer ?? 0) > 20 + Math.random() * 40) {
          p.char = Math.floor(Math.random() * 256).toString(16).toUpperCase().padStart(2, '0')
          p.charTimer = 0
        }
        if (p.y > h + 20) { p.y = -20; p.x = Math.random() * w }
        break
      }
      case 'bubbles': {
        p.pulsePhase = (p.pulsePhase ?? 0) + 0.02
        const pAlpha = p.alpha * (0.7 + Math.sin(p.pulsePhase) * 0.3)
        ctx.globalAlpha = pAlpha
        ctx.strokeStyle = '#aaddff'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.stroke()
        p.x += p.vx * speed * 60
        p.y += p.vy * speed * 60
        if (p.y < -p.size * 2) { p.y = h + p.size; p.x = Math.random() * w }
        break
      }
      case 'kanji': {
        ctx.globalAlpha = p.alpha
        ctx.fillStyle = '#aa44ff'
        ctx.font = `${p.size}px serif`
        ctx.fillText(p.char ?? '字', p.x, p.y)
        p.y += p.vy * speed * 60
        p.charTimer = (p.charTimer ?? 0) + 1
        if ((p.charTimer ?? 0) > 30 + Math.random() * 60) {
          p.char = String.fromCharCode(0x4e00 + Math.floor(Math.random() * 0x2000))
          p.charTimer = 0
        }
        if (p.y > h + 20) { p.y = -20; p.x = Math.random() * w }
        break
      }
      case 'aura': {
        p.pulsePhase = (p.pulsePhase ?? 0) + 0.06
        const auraGlow = 0.6 + Math.sin(p.pulsePhase) * 0.4
        ctx.globalAlpha = p.alpha * auraGlow
        const ag = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3)
        ag.addColorStop(0, 'rgba(255,210,50,0.9)')
        ag.addColorStop(1, 'rgba(255,160,0,0)')
        ctx.fillStyle = ag
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2)
        ctx.fill()
        p.x += p.vx * speed * 60
        p.y += p.vy * speed * 60
        p.vx += (Math.random() - 0.5) * 0.04
        if (p.y < -20) { p.y = h + 20; p.x = Math.random() * w }
        break
      }
      case 'sparkle': {
        p.pulsePhase = (p.pulsePhase ?? 0) + 0.04
        const sAlpha = Math.abs(Math.sin(p.pulsePhase))
        ctx.globalAlpha = sAlpha
        const hue = (frame * 2 + p.x * 0.1) % 360
        ctx.strokeStyle = `hsl(${hue},100%,75%)`
        ctx.lineWidth = 1.5
        const s = p.size * sAlpha
        ctx.beginPath()
        ctx.moveTo(p.x - s, p.y); ctx.lineTo(p.x + s, p.y)
        ctx.moveTo(p.x, p.y - s); ctx.lineTo(p.x, p.y + s)
        ctx.moveTo(p.x - s * 0.7, p.y - s * 0.7); ctx.lineTo(p.x + s * 0.7, p.y + s * 0.7)
        ctx.moveTo(p.x + s * 0.7, p.y - s * 0.7); ctx.lineTo(p.x - s * 0.7, p.y + s * 0.7)
        ctx.stroke()
        p.x += p.vx * speed * 60
        p.y += p.vy * speed * 60
        if (p.x < 0 || p.x > w) p.vx *= -1
        if (p.y < 0 || p.y > h) p.vy *= -1
        break
      }
      case 'dandelion': {
        p.pulsePhase = (p.pulsePhase ?? 0) + 0.008
        p.vx = Math.sin(p.pulsePhase * 3) * 0.25
        ctx.globalAlpha = p.alpha
        ctx.fillStyle = '#ffffffcc'
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
        // small trailing line
        ctx.strokeStyle = '#ffffff55'
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.moveTo(p.x, p.y)
        ctx.lineTo(p.x - p.vx * 4, p.y + 6)
        ctx.stroke()
        p.x += p.vx * speed * 60
        p.y += p.vy * speed * 60
        if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w }
        break
      }
      case 'code-rain': {
        ctx.globalAlpha = p.alpha
        ctx.fillStyle = '#00ddff'
        ctx.font = `bold ${p.size}px monospace`
        ctx.fillText(p.char ?? 'null', p.x, p.y)
        p.y += p.vy * speed * 60
        p.charTimer = (p.charTimer ?? 0) + 1
        if ((p.charTimer ?? 0) > 25 + Math.random() * 50) {
          const words = ['null','404','err','0x','void','NaN','if()','[];','true','false','sudo']
          p.char = words[Math.floor(Math.random() * words.length)]
          p.charTimer = 0
        }
        if (p.y > h + 20) { p.y = -20; p.x = Math.random() * w }
        break
      }
    }
  }

  ctx.globalAlpha = 1
}

const PARTICLE_COUNTS: Record<ParticlePreset, (density: number) => number> = {
  none:      () => 0,
  stars:     (d) => Math.round(200 + d * 400),
  snow:      (d) => Math.round(30 + d * 120),
  matrix:    (d) => Math.round(30 + d * 90),
  fireflies: (d) => Math.round(10 + d * 40),
  ash:       (d) => Math.round(50 + d * 150),
  rain:      (d) => Math.round(60 + d * 140),
  embers:    (d) => Math.round(20 + d * 60),
  sakura:    (d) => Math.round(15 + d * 50),
  hearts:    (d) => Math.round(8  + d * 22),
  hex:       (d) => Math.round(30 + d * 90),
  bubbles:   (d) => Math.round(12 + d * 35),
  kanji:     (d) => Math.round(25 + d * 70),
  aura:      (d) => Math.round(30 + d * 80),
  sparkle:   (d) => Math.round(15 + d * 45),
  dandelion: (d) => Math.round(20 + d * 55),
  'code-rain': (d) => Math.round(25 + d * 75),
}

interface Props extends OverlayParticles {}

export function ParticlesLayer({ enabled, preset, density, speed }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef  = useRef({ particles: [] as Particle[], frame: 0, running: false })
  const rafRef    = useRef<number>(0)

  useEffect(() => {
    if (!enabled || preset === 'none') return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = 1920, H = 1080
    canvas.width  = W
    canvas.height = H

    const count = PARTICLE_COUNTS[preset](density)
    stateRef.current.particles = initParticles(preset, count, W, H)
    stateRef.current.running = true

    const tick = () => {
      stateRef.current.frame++
      drawFrame(ctx, stateRef.current.particles, preset, speed, W, H, stateRef.current.frame)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(rafRef.current)
      ctx.clearRect(0, 0, W, H)
    }
  }, [enabled, preset, density, speed])

  if (!enabled || preset === 'none') return null

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    />
  )
}
