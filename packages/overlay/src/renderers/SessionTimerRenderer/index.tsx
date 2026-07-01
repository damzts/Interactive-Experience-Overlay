import { useState, useEffect, useRef } from 'react'
import type { RendererProps } from '../registry'

function formatTime(seconds: number, fmt: string): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  if (fmt === 'ms') return `${pad(m)}:${pad(s)}`
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

/** SESSION-TIMER — stopwatch counting up since component mount. */
export function SessionTimerRenderer({ config }: RendererProps) {
  const label    = config.label  ? String(config.label)  : ''
  const color    = String(config.color    ?? '#00ff41')
  const fontSize = Number(config.fontSize ?? 28)
  const format   = String(config.format   ?? 'hms')
  const position = String(config.position ?? 'top-left')

  const startRef = useRef(Date.now())
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [])

  const posStyle: React.CSSProperties = {
    top:    position.includes('top')    ? 20 : undefined,
    bottom: position.includes('bottom') ? 20 : undefined,
    left:   position.includes('left')   ? 24 : undefined,
    right:  position.includes('right')  ? 24 : undefined,
  }

  return (
    <div style={{
      position: 'absolute', ...posStyle,
      fontFamily: 'VT323, monospace',
      fontSize,
      color,
      textShadow: `0 0 10px ${color}`,
      pointerEvents: 'none',
      letterSpacing: 2,
    }}>
      {label && <span style={{ color: '#888', marginRight: 8, fontSize: fontSize * 0.7 }}>{label}</span>}
      {formatTime(elapsed, format)}
    </div>
  )
}
