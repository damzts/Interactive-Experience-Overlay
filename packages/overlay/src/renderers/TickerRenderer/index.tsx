import { useState, useEffect, useRef } from 'react'
import type { RendererProps } from '../registry'

/** TICKER — scrolling bottom ticker showing custom stream info. */
export function TickerRenderer({ config }: RendererProps) {
  const items     = (config.items as string[] | undefined) ?? ['Now streaming', 'Welcome to the session']
  const speed     = Number(config.speed     ?? 60)   // px per second
  const separator = String(config.separator ?? '  ✦  ')
  const color     = String(config.color     ?? '#00ff41')
  const bgColor   = String(config.bgColor   ?? 'rgba(0,0,0,0.7)')
  const fontSize  = Number(config.fontSize  ?? 20)

  const text  = items.join(separator) + separator
  const elRef = useRef<HTMLDivElement>(null)
  const [offset, setOffset] = useState(0)
  const animRef = useRef<number>(0)
  const lastTs  = useRef(0)
  const widthRef = useRef(0)

  useEffect(() => {
    const el = elRef.current
    if (!el) return
    widthRef.current = el.scrollWidth / 2  // text repeated twice for seamless loop

    const tick = (ts: number) => {
      if (lastTs.current) {
        const dt = (ts - lastTs.current) / 1000
        setOffset(prev => {
          const next = prev + speed * dt
          return next >= widthRef.current ? next - widthRef.current : next
        })
      }
      lastTs.current = ts
      animRef.current = requestAnimationFrame(tick)
    }
    animRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animRef.current)
  }, [speed, text])

  const repeated = text + text

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', alignItems: 'flex-end',
      pointerEvents: 'none', overflow: 'hidden',
    }}>
      <div style={{
        width: '100%', overflow: 'hidden',
        background: bgColor,
        borderTop: `1px solid ${color}44`,
        padding: '4px 0',
      }}>
        <div
          ref={elRef}
          style={{
            whiteSpace: 'nowrap',
            fontFamily: 'VT323, monospace',
            fontSize,
            color,
            textShadow: `0 0 8px ${color}`,
            transform: `translateX(-${offset}px)`,
            willChange: 'transform',
            display: 'inline-block',
          }}
        >
          {repeated}
        </div>
      </div>
    </div>
  )
}
