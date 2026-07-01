import type { RendererProps } from '../registry'

/** CHAPTER — persistent chapter/arc label for narrative stream structure. */
export function ChapterRenderer({ config }: RendererProps) {
  const number   = config.number   != null ? String(config.number) : null
  const label    = String(config.label    ?? 'Chapter')
  const color    = String(config.color    ?? '#ffffff')
  const accent   = String(config.accent   ?? '#888888')
  const fontSize = Number(config.fontSize ?? 22)
  const position = String(config.position ?? 'top-right')

  const posStyle: React.CSSProperties = {
    top:    position.includes('top')    ? 24 : undefined,
    bottom: position.includes('bottom') ? 24 : undefined,
    left:   position.includes('left')   ? 32 : undefined,
    right:  position.includes('right')  ? 32 : undefined,
  }

  return (
    <div style={{
      position: 'absolute', ...posStyle,
      fontFamily: 'VT323, monospace',
      pointerEvents: 'none',
      textAlign: position.includes('right') ? 'right' : 'left',
    }}>
      {number && (
        <div style={{ fontSize: fontSize * 0.65, color: accent, letterSpacing: 4, textTransform: 'uppercase', marginBottom: 2 }}>
          Chapter {number}
        </div>
      )}
      <div style={{ fontSize, color, letterSpacing: 2, textShadow: `0 0 12px ${color}44` }}>
        {label}
      </div>
    </div>
  )
}
