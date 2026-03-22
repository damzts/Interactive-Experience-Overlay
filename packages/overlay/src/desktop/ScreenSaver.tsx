import { useState, useEffect, useRef, useCallback } from 'react'
import type { DesktopScreenSaverPreviewPayload } from '@ieom/shared'
import { socket } from '../socket/client'
import { useAppStore } from '../store/useAppStore'

type Preset = DesktopScreenSaverPreviewPayload['preset']

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

// ── Pipes 3D preset ────────────────────────────────────────────────────────
const PIPE_COLORS = ['#ff4444', '#44ff44', '#4444ff', '#ffff44', '#ff44ff', '#44ffff', '#ff8800', '#00ffcc']
const PIPE_W = 16

function PipesPreset() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    canvas.width  = 1920
    canvas.height = 1080
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const cols = Math.floor(canvas.width  / PIPE_W)
    const rows = Math.floor(canvas.height / PIPE_W)
    type Dir = 'R' | 'L' | 'U' | 'D'
    const DIRS: Dir[] = ['R', 'L', 'U', 'D']
    const dx: Record<Dir, number> = { R: 1,  L: -1, U: 0, D: 0 }
    const dy: Record<Dir, number> = { R: 0,  L: 0,  U: -1, D: 1 }

    const pipes: { x: number; y: number; dir: Dir; color: string; steps: number }[] = []

    const spawn = () => {
      pipes.push({
        x:     Math.floor(Math.random() * cols),
        y:     Math.floor(Math.random() * rows),
        dir:   DIRS[Math.floor(Math.random() * 4)],
        color: PIPE_COLORS[Math.floor(Math.random() * PIPE_COLORS.length)],
        steps: 0,
      })
    }

    // Seed with a few pipes
    for (let i = 0; i < 6; i++) spawn()

    let raf: number
    const tick = () => {
      for (const pipe of pipes) {
        // Occasionally turn
        if (pipe.steps > 0 && Math.random() < 0.12) {
          const turns = DIRS.filter((d) => d !== pipe.dir && (
            (d === 'R' && pipe.dir !== 'L') ||
            (d === 'L' && pipe.dir !== 'R') ||
            (d === 'U' && pipe.dir !== 'D') ||
            (d === 'D' && pipe.dir !== 'U')
          ))
          if (turns.length) pipe.dir = turns[Math.floor(Math.random() * turns.length)]
        }

        const nx = pipe.x + dx[pipe.dir]
        const ny = pipe.y + dy[pipe.dir]

        // Wrap around
        pipe.x = ((nx % cols) + cols) % cols
        pipe.y = ((ny % rows) + rows) % rows
        pipe.steps++

        // Draw segment
        ctx.fillStyle = pipe.color
        ctx.shadowColor = pipe.color
        ctx.shadowBlur = 6
        ctx.fillRect(pipe.x * PIPE_W + 1, pipe.y * PIPE_W + 1, PIPE_W - 2, PIPE_W - 2)
        ctx.shadowBlur = 0

        // Draw joint dot at turns
        if (pipe.steps > 1 && Math.random() < 0.12) {
          ctx.fillStyle = '#fff'
          ctx.beginPath()
          ctx.arc(pipe.x * PIPE_W + PIPE_W / 2, pipe.y * PIPE_W + PIPE_W / 2, PIPE_W / 4, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // Occasionally reset canvas and add a new pipe
      if (Math.random() < 0.003) {
        ctx.fillStyle = 'rgba(0,0,0,0.04)'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        if (pipes.length < 20) spawn()
      }

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
}

// ── Gallery scroll preset (idle asset browser) ───────────────────────────
function GalleryScrollPreset() {
  const [images, setImages] = useState<string[]>([])
  const [idx,    setIdx]    = useState(0)
  const [game,   setGame]   = useState('')

  useEffect(() => {
    fetch('/api/media/list')
      .then((r) => r.json())
      .then((data: { games: Record<string, string[]> }) => {
        const entries: { url: string; game: string }[] = []
        for (const [name, urls] of Object.entries(data.games)) {
          for (const url of urls) entries.push({ url, game: name })
        }
        // Shuffle
        for (let i = entries.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [entries[i], entries[j]] = [entries[j], entries[i]]
        }
        setImages(entries.map((e) => e.url))
        if (entries[0]) setGame(entries[0].game)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (images.length === 0) return
    const t = setInterval(() => {
      setIdx((i) => {
        const next = (i + 1) % images.length
        return next
      })
    }, 4000)
    return () => clearInterval(t)
  }, [images])

  // Derive game name from current image path
  useEffect(() => {
    if (!images[idx]) return
    // Path pattern: /media/games/0001_Game Name/file.jpg or similar
    const match = images[idx].match(/\/([^\/]+)\/[^\/]+$/)
    const folder = match?.[1] ?? ''
    // Strip leading number prefix like "0001_"
    setGame(folder.replace(/^\d+_/, '').replace(/_/g, ' '))
  }, [idx, images])

  if (images.length === 0) {
    return (
      <div style={{ position: 'absolute', inset: 0, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#444', fontFamily: 'VT323, monospace', fontSize: 24 }}>No game images found</span>
      </div>
    )
  }

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#000', overflow: 'hidden' }}>
      {images.map((url, i) => (
        <div
          key={url}
          style={{
            position: 'absolute', inset: 0,
            backgroundImage: `url(${url})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity:    i === idx ? 1 : 0,
            transition: 'opacity 1s ease-in-out',
            filter: 'brightness(0.7)',
          }}
        />
      ))}
      {/* Game title overlay */}
      <div style={{
        position: 'absolute', bottom: 48, left: 64, right: 64,
        fontFamily: 'VT323, monospace', fontSize: 36,
        color: '#fff', textShadow: '0 0 16px #000, 0 2px 4px #000',
        letterSpacing: 2,
      }}>
        {game}
      </div>
    </div>
  )
}

// ── Screen saver root ─────────────────────────────────────────────────────
interface ScreenSaverProps {
  timeoutMinutes: number
  preset: Preset
  enabled: boolean
}

const SCREEN_SAVER_PREVIEW_DURATION_MS = 15000

export function ScreenSaver({ timeoutMinutes, preset, enabled }: ScreenSaverProps) {
  const [active, setActive] = useState(false)
  const [previewPreset, setPreviewPreset] = useState<Preset | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previewActiveRef = useRef(false)
  const visualState = useAppStore((s) => s.visualState)

  const resetTimer = useCallback(() => {
    previewActiveRef.current = false
    setPreviewPreset(null)
    setActive(false)
    if (timerRef.current) clearTimeout(timerRef.current)
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current)
    if (!enabled) return
    timerRef.current = setTimeout(() => setActive(true), timeoutMinutes * 60 * 1000)
  }, [enabled, timeoutMinutes])

  // Reset on any state change (scene switch = activity)
  useEffect(() => {
    if (previewActiveRef.current) return
    resetTimer()
  }, [visualState, resetTimer])

  // Reset on server socket messages (any admin action counts as activity)
  useEffect(() => {
    const onAny = (eventName: string) => {
      if (eventName === 'desktop:screen-saver:test' || previewActiveRef.current) return
      resetTimer()
    }
    socket.onAny(onAny)
    return () => { socket.offAny(onAny) }
  }, [resetTimer])

  useEffect(() => {
    const onPreview = (payload: DesktopScreenSaverPreviewPayload) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current)
      previewActiveRef.current = true
      setPreviewPreset(payload.preset)
      setActive(true)
      previewTimerRef.current = setTimeout(() => {
        previewActiveRef.current = false
        resetTimer()
      }, SCREEN_SAVER_PREVIEW_DURATION_MS)
    }

    socket.on('desktop:screen-saver:test', onPreview)
    return () => {
      socket.off('desktop:screen-saver:test', onPreview)
    }
  }, [])

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

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current)
    }
  }, [])

  const effectivePreset = previewPreset ?? preset

  if (!active || (!enabled && !previewPreset)) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 90, cursor: 'none' }}>
      {effectivePreset === 'starfield'      && <Starfield />}
      {effectivePreset === 'marquee'        && <MarqueePreset />}
      {effectivePreset === 'flying-windows' && <FlyingWindows />}
      {effectivePreset === 'pipes'          && <PipesPreset />}
      {effectivePreset === 'blank'          && <BlankPreset />}
      {effectivePreset === 'gallery-scroll' && <GalleryScrollPreset />}
    </div>
  )
}
