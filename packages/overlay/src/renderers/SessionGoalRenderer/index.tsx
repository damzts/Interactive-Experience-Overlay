import type { RendererProps } from '../registry'

/** SESSION-GOAL — custom freeform goal bar (non-Twitch). Label + progress. */
export function SessionGoalRenderer({ config }: RendererProps) {
  const label    = String(config.label   ?? 'Session Goal')
  const current  = Number(config.current ?? 0)
  const target   = Number(config.target  ?? 100)
  const color    = String(config.color   ?? '#00ff41')
  const bgColor  = String(config.bgColor ?? 'rgba(0,0,0,0.7)')
  const showCount = config.showCount !== false
  const fontSize = Number(config.fontSize ?? 18)

  const pct = target > 0 ? Math.min(1, current / target) : 0

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none',
    }}>
      <div style={{
        background: bgColor,
        border: `1px solid ${color}55`,
        padding: '10px 18px',
        minWidth: 280,
        fontFamily: 'VT323, monospace',
        color,
      }}>
        <div style={{ fontSize, letterSpacing: 2, marginBottom: 6, textTransform: 'uppercase' }}>
          {label}
          {showCount && (
            <span style={{ float: 'right', color: '#aaa' }}>{current}/{target}</span>
          )}
        </div>
        <div style={{
          width: '100%', height: 12,
          background: 'rgba(255,255,255,0.1)',
          border: `1px solid ${color}44`,
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${pct * 100}%`, height: '100%',
            background: color,
            boxShadow: `0 0 8px ${color}`,
            transition: 'width 0.4s ease',
          }} />
        </div>
      </div>
    </div>
  )
}
