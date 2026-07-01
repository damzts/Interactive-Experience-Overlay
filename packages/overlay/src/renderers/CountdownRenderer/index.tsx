import { useState, useEffect } from 'react'
import type { RendererProps } from '../registry'

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00'
  const totalSec = Math.ceil(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** COUNTDOWN — configurable countdown timer. Shows label + MM:SS remaining. */
export function CountdownRenderer({ config }: RendererProps) {
  const label      = String(config.label      ?? 'BRB in')
  const durationMs = Number(config.durationMs ?? 300_000) // 5 min default
  const color      = String(config.color      ?? '#ffffff')
  const accent     = String(config.accent     ?? '#ff4444')
  const fontSize   = Number(config.fontSize   ?? 32)
  const position   = String(config.position   ?? 'center')

  const [remaining, setRemaining] = useState(durationMs)

  useEffect(() => {
    setRemaining(durationMs)
    const start = Date.now()
    const id = setInterval(() => {
      const left = durationMs - (Date.now() - start)
      setRemaining(Math.max(0, left))
      if (left <= 0) clearInterval(id)
    }, 250)
    return () => clearInterval(id)
  }, [durationMs])

  const posStyle: React.CSSProperties =
    position === 'center'
      ? { top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }
      : position === 'top'
      ? { top: 24, left: '50%', transform: 'translateX(-50%)' }
      : { bottom: 24, left: '50%', transform: 'translateX(-50%)' }

  const done = remaining <= 0

  return (
    <div style={{
      position: 'absolute', ...posStyle,
      fontFamily: 'VT323, monospace',
      textAlign: 'center',
      pointerEvents: 'none',
    }}>
      <div style={{ fontSize: fontSize * 0.6, color: '#888', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{
        fontSize,
        color: done ? accent : color,
        letterSpacing: 4,
        textShadow: `0 0 16px ${done ? accent : color}`,
      }}>
        {done ? 'BACK' : formatCountdown(remaining)}
      </div>
    </div>
  )
}
