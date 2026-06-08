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
