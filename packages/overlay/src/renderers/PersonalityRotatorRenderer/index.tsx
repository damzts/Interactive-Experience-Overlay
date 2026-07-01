import { useEffect, useRef, useState } from 'react'
import type { RendererProps } from '../registry'

interface Card {
  icon: string
  title: string
  subtitle?: string
}

const DEFAULT_CARDS: Card[] = [
  { icon: '⚔', title: 'CHAPTER 1', subtitle: 'THE BEGINNING' },
  { icon: '🔥', title: 'MODE: GRIND', subtitle: 'NO DAYS OFF' },
  { icon: '☕', title: 'STATUS: CAFFEINATED', subtitle: 'FUEL ACQUIRED' },
  { icon: '🎯', title: 'OBJECTIVE', subtitle: 'WIN OR LEARN' },
  { icon: '🌙', title: 'LATE NIGHT SESSION', subtitle: 'THE REAL ONES KNOW' },
  { icon: '💀', title: 'DANGER ZONE', subtitle: 'PROCEED WITH CAUTION' },
  { icon: '✨', title: 'FLOW STATE', subtitle: 'DO NOT DISTURB' },
]

export function PersonalityRotatorRenderer({ config }: RendererProps) {
  const cards      = (config.cards      as Card[] | undefined) ?? DEFAULT_CARDS
  const durationMs = (config.durationMs as number | undefined) ?? 6000
  const transition = (config.transition as 'fade' | 'slide' | undefined) ?? 'fade'
  const color      = (config.color      as string | undefined) ?? '#ffffff'
  const accent     = (config.accent     as string | undefined) ?? '#f5c400'

  const [idx,     setIdx]     = useState(0)
  const [visible, setVisible] = useState(true)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null!)

  useEffect(() => {
    const cycle = () => {
      setVisible(false)
      timerRef.current = setTimeout(() => {
        setIdx(i => (i + 1) % cards.length)
        setVisible(true)
        timerRef.current = setTimeout(cycle, durationMs - 500)
      }, 500)
    }
    timerRef.current = setTimeout(cycle, durationMs - 500)
    return () => clearTimeout(timerRef.current)
  }, [cards, durationMs])

  const card = cards[idx % cards.length]

  const slideStyle = transition === 'slide'
    ? { transform: visible ? 'translateX(0)' : 'translateX(-20px)' }
    : {}

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 6,
        padding: '12px 16px',
        opacity: visible ? 1 : 0,
        transition: `opacity 0.45s ease${transition === 'slide' ? ', transform 0.45s cubic-bezier(0.34,1.56,0.64,1)' : ''}`,
        ...slideStyle,
        fontFamily: 'Impact,"Arial Black",sans-serif',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 28, lineHeight: 1 }}>{card.icon}</div>
      <div
        style={{
          fontSize: 18,
          letterSpacing: 3,
          color: accent,
          textShadow: `0 0 16px ${accent}88`,
          lineHeight: 1.2,
        }}
      >
        {card.title}
      </div>
      {card.subtitle && (
        <div
          style={{
            fontSize: 11,
            letterSpacing: 2,
            color: color + 'aa',
            textTransform: 'uppercase',
          }}
        >
          {card.subtitle}
        </div>
      )}
    </div>
  )
}
