import { useState, useEffect, useRef, useCallback } from 'react'
import { socket } from '../socket/client'
import { useAppStore } from '../store/useAppStore'

type Preset = 'starfield' | 'marquee' | 'pipes' | 'blank' | 'flying-windows'

// ── Starfield preset ──────────────────────────────────────────────────────
interface Star { x: number; y: number; vx: number; vy: number; size: number }

function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width  = window.innerWidth
    const H = canvas.height = window.innerHeight
    const cx = W / 2, cy = H / 2

    const stars: Star[] = Array.from({ length: 200 }, () => ({
      x: Math.random() * W - cx,
      y: Math.random() * H - cy,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      size: Math.random() * 1.5 + 0.3,
    }))

    let raf = 0
    const draw = () => {
      ctx.fillStyle = 'rgba(0,0,0,0.15)'
      ctx.fillRect(0, 0, W, H)
      for (const s of stars) {
        s.vx *= 1.02; s.vy *= 1.02
        s.x += s.vx; s.y += s.vy
        if (Math.abs(s.x) > cx + 20 || Math.abs(s.y) > cy + 20) {
          s.x = (Math.random() - 0.5) * 60
          s.y = (Math.random() - 0.5) * 60
          s.vx = (Math.random() - 0.5) * 0.5
          s.vy = (Math.random() - 0.5) * 0.5
        }
        const brightness = Math.min(1, Math.sqrt(s.vx * s.vx + s.vy * s.vy) / 8)
        ctx.fillStyle = `rgba(255,255,255,${0.4 + brightness * 0.6})`
        ctx.beginPath()
        ctx.arc(cx + s.x, cy + s.y, s.size, 0, Math.PI * 2)
        ctx.fill()
      }
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [])

  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
}

// ── Marquee preset ────────────────────────────────────────────────────────
const MARQUEE_LINES = [
  '> CONNECTION ESTABLISHED',
  '> LOADING USER DATA...',
  '> ACCESSING SYSTEM32',
  '> MEMORY USAGE: 97%',
  '> ERROR 404: SLEEP NOT FOUND',
  '> ONLINE USERS: YOU AND YOUR DEMONS',
  '> MODEM: CONNECTING... 28800 BAUD',
  '> NO NEW MESSAGES',
  '> LAST BACKUP: NEVER',
  '> RUNNING DEFRAG... PLEASE WAIT',
  '> TIME: LATE',
]

function MarqueePreset() {
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#000', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 28 }}>
      {MARQUEE_LINES.map((line, i) => (
        <div
          key={i}
          style={{
            fontFamily: 'VT323, monospace',
            fontSize: 22,
            color: '#00ff88',
            whiteSpace: 'nowrap',
            animation: `ss-scroll-${i % 2 === 0 ? 'l' : 'r'} ${14 + i * 2}s linear infinite`,
            animationDelay: `${i * -1.5}s`,
            textShadow: '0 0 8px #00ff88',
            opacity: 0.7 + (i % 3) * 0.1,
          }}
        >
          {line}
        </div>
      ))}
    </div>
  )
}

// ── Flying windows preset ─────────────────────────────────────────────────
interface FlyShape { x: number; y: number; vx: number; vy: number; w: number; h: number; color: string }

function FlyingWindows() {
  const [shapes] = useState<FlyShape[]>(() => {
    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ff8800']
    return Array.from({ length: 12 }, (_, i) => ({
      x: Math.random() * 1920,
      y: Math.random() * 1080,
      vx: (Math.random() - 0.5) * 3,
      vy: (Math.random() - 0.5) * 3,
      w: 80 + Math.random() * 120,
      h: 60 + Math.random() * 80,
      color: colors[i % colors.length],
    }))
  })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      for (const s of shapes) {
        s.x += s.vx; s.y += s.vy
        if (s.x < -200 || s.x > 2100) s.vx *= -1
        if (s.y < -200 || s.y > 1280) s.vy *= -1
      }
      setTick((t) => t + 1)
    }, 16)
    return () => clearInterval(id)
  }, [shapes])

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#000' }}>
      {shapes.map((s, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: s.x,
            top: s.y,
            width: s.w,
            height: s.h,
            background: s.color,
            opacity: 0.7,
            border: '2px solid rgba(255,255,255,0.3)',
          }}
        />
      ))}
      {/* Suppress unused tick warning */}
      <span style={{ display: 'none' }}>{tick}</span>
    </div>
  )
}

// ── Dim overlay (blank preset) ─────────────────────────────────────────────
function BlankPreset() {
  return <div style={{ position: 'absolute', inset: 0, background: '#000', opacity: 0.95 }} />
}

// ── Screen saver root ─────────────────────────────────────────────────────
interface ScreenSaverProps {
  timeoutMinutes: number
  preset: Preset
  enabled: boolean
}

export function ScreenSaver({ timeoutMinutes, preset, enabled }: ScreenSaverProps) {
  const [active, setActive] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const visualState = useAppStore((s) => s.visualState)

  const resetTimer = useCallback(() => {
    setActive(false)
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!enabled) return
    timerRef.current = setTimeout(() => setActive(true), timeoutMinutes * 60 * 1000)
  }, [enabled, timeoutMinutes])

  // Reset on any state change (scene switch = activity)
  useEffect(() => {
    resetTimer()
  }, [visualState, resetTimer])

  // Reset on server socket messages (any admin action counts as activity)
  useEffect(() => {
    const onAny = () => resetTimer()
    socket.onAny(onAny)
    return () => { socket.offAny(onAny) }
  }, [resetTimer])

  // Dismiss on any click/keypress
  useEffect(() => {
    if (!active) return
    const dismiss = () => resetTimer()
    window.addEventListener('click', dismiss)
    window.addEventListener('keydown', dismiss)
    return () => {
      window.removeEventListener('click', dismiss)
      window.removeEventListener('keydown', dismiss)
    }
  }, [active, resetTimer])

  if (!active || !enabled) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 90, cursor: 'none' }}>
      {preset === 'starfield'       && <Starfield />}
      {preset === 'marquee'         && <MarqueePreset />}
      {preset === 'flying-windows'  && <FlyingWindows />}
      {(preset === 'blank' || preset === 'pipes') && <BlankPreset />}
    </div>
  )
}
