import { useEffect, useRef, useState } from 'react'
import type { RendererProps } from '../registry'

const TIERS = [
  { label: 'TILT',    color: '#ff4444', threshold: 0.2 },
  { label: 'MEH',     color: '#ff9900', threshold: 0.4 },
  { label: 'FOCUS',   color: '#ffcc00', threshold: 0.6 },
  { label: 'LOCKED',  color: '#66ff66', threshold: 0.8 },
  { label: 'GOD MODE',color: '#ff00ff', threshold: 1.1 },
]

export function MoodMeterRenderer({ config }: RendererProps) {
  const label       = (config.label       as string | undefined) ?? 'POWER LEVEL'
  const color       = (config.color       as string | undefined) ?? '#f5c400'
  const fluctuateMs = (config.fluctuateMs as number | undefined) ?? 1500
  const baseValue   = Math.min(1, Math.max(0, (config.baseValue as number | undefined) ?? 0.6))
  const variance    = Math.min(0.5, (config.variance as number | undefined) ?? 0.25)

  const [level, setLevel]   = useState(baseValue)
  const [prev,  setPrev]    = useState(baseValue)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null!)

  useEffect(() => {
    const fluctuate = () => {
      const next = Math.min(1, Math.max(0, baseValue + (Math.random() - 0.5) * 2 * variance))
      setPrev(level)
      setLevel(next)
      timerRef.current = setTimeout(fluctuate, fluctuateMs * (0.7 + Math.random() * 0.6))
    }
    timerRef.current = setTimeout(fluctuate, fluctuateMs)
    return () => clearTimeout(timerRef.current)
  }, [baseValue, variance, fluctuateMs])

  const tier = TIERS.find(t => level <= t.threshold) ?? TIERS[TIERS.length - 1]
  const barColor = tier.color

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10,
        padding: 12,
        fontFamily: 'Impact,Arial,sans-serif',
      }}
    >
      <div style={{ fontSize: 11, letterSpacing: 3, color: color + 'cc', textTransform: 'uppercase' }}>
        {label}
      </div>
      {/* Vertical bar */}
      <div
        style={{
          width: 28,
          height: '70%',
          background: 'rgba(0,0,0,0.5)',
          border: `1px solid ${color}44`,
          borderRadius: 4,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
        }}
      >
        <div
          style={{
            width: '100%',
            height: `${level * 100}%`,
            background: `linear-gradient(180deg, ${barColor} 0%, ${barColor}88 100%)`,
            boxShadow: `0 0 12px ${barColor}`,
            transition: `height ${fluctuateMs * 0.6}ms cubic-bezier(0.34, 1.56, 0.64, 1)`,
          }}
        />
      </div>
      <div
        style={{
          fontSize: 13,
          letterSpacing: 2,
          color: barColor,
          textShadow: `0 0 10px ${barColor}`,
          transition: 'color 0.4s',
        }}
      >
        {tier.label}
      </div>
    </div>
  )
}
