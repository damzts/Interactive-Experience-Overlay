import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import type { RendererProps } from '../registry'

/** STATUS-BADGE — persistent corner badge showing stream mode ("GRINDING", "AFK", etc.). */
export function StatusBadgeRenderer({ config }: RendererProps) {
  const text     = String(config.text     ?? 'LIVE')
  const icon     = config.icon   ? String(config.icon)   : null
  const color    = String(config.color    ?? '#00ff41')
  const bgColor  = String(config.bgColor  ?? 'rgba(0,0,0,0.75)')
  const position = String(config.position ?? 'top-left')
  const pulse    = config.pulse !== false
  const fontSize = Number(config.fontSize ?? 18)

  const dotRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!pulse || !dotRef.current) return
    gsap.to(dotRef.current, {
      opacity: 0.2, duration: 0.9, repeat: -1, yoyo: true, ease: 'sine.inOut',
    })
    return () => { if (dotRef.current) gsap.killTweensOf(dotRef.current) }
  }, [pulse])

  const posStyle: React.CSSProperties = {
    top:    position.includes('top')    ? 20 : undefined,
    bottom: position.includes('bottom') ? 20 : undefined,
    left:   position.includes('left')   ? 24 : undefined,
    right:  position.includes('right')  ? 24 : undefined,
  }

  return (
    <div style={{
      position: 'absolute', ...posStyle,
      display: 'inline-flex', alignItems: 'center', gap: 8,
      background: bgColor,
      border: `1px solid ${color}66`,
      padding: '5px 12px',
      fontFamily: 'VT323, monospace',
      fontSize,
      color,
      letterSpacing: 2,
      textTransform: 'uppercase',
      pointerEvents: 'none',
      boxShadow: `0 0 10px ${color}33`,
    }}>
      {pulse && (
        <div ref={dotRef} style={{
          width: 8, height: 8, borderRadius: '50%',
          background: color, flexShrink: 0,
        }} />
      )}
      {icon && <span style={{ fontSize: fontSize + 2 }}>{icon}</span>}
      {text}
    </div>
  )
}
