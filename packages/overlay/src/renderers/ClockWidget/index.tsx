import { useState, useEffect } from 'react'

const FONT_MAP: Record<string, string> = {
  vt323:           "'VT323', monospace",
  'press-start':   "'Press Start 2P', monospace",
  monospace:       'monospace',
  serif:           'serif',
}

export function ClockWidgetRenderer({ config }: import('../registry').RendererProps) {
  const format   = String(config.format   ?? '24h')
  const color    = String(config.color    ?? '#00ff41')
  const fontSize = Number(config.fontSize ?? 28)
  const font     = String(config.font     ?? 'vt323')

  const [time, setTime] = useState('')

  useEffect(() => {
    const fmt = () => {
      const now  = new Date()
      const h24  = now.getHours()
      const m    = now.getMinutes()
      const s    = now.getSeconds()
      const pad  = (n: number) => String(n).padStart(2, '0')

      if (format === '24h')     return `${pad(h24)}:${pad(m)}`
      if (format === '24h-sec') return `${pad(h24)}:${pad(m)}:${pad(s)}`
      const h12  = h24 % 12 || 12
      const ampm = h24 < 12 ? 'AM' : 'PM'
      if (format === '12h')     return `${h12}:${pad(m)} ${ampm}`
      return `${h12}:${pad(m)}:${pad(s)} ${ampm}`
    }

    setTime(fmt())
    const id = setInterval(() => setTime(fmt()), 1000)
    return () => clearInterval(id)
  }, [format])

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: FONT_MAP[font] ?? 'monospace',
        fontSize,
        color,
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
      }}
    >
      {time}
    </div>
  )
}
