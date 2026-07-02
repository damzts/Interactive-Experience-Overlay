import { useEffect, useState } from 'react'
import { DesktopWindow } from './DesktopWindow'
import { addWidgetChainActionListener } from './widgetSimulationEvents'

interface RpgStatsWidgetProps {
  appId?: string
  onClose: () => void
  onMinimize?: () => void
  onFocus?: () => void
  windowState?: 'open' | 'closing'
  zIndex?: number
}

const STAT_KEYS = ['STR', 'INT', 'AGI', 'VIT'] as const

/** RPG-STATS — character stats panel that slowly evolves over the session, levels up on chain action. */
export function RpgStatsWidget({
  appId = 'rpg-stats',
  onClose,
  onMinimize,
  onFocus,
  windowState = 'open',
  zIndex,
}: RpgStatsWidgetProps) {
  const [level, setLevel] = useState(1)
  const [stats, setStats] = useState<Record<(typeof STAT_KEYS)[number], number>>({ STR: 8, INT: 8, AGI: 8, VIT: 8 })

  useEffect(() => {
    const id = setInterval(() => {
      setStats((prev) => {
        const key = STAT_KEYS[Math.floor(Math.random() * STAT_KEYS.length)]
        return { ...prev, [key]: Math.min(99, prev[key] + 1) }
      })
    }, 45000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    return addWidgetChainActionListener(({ targetWidgetId, action }) => {
      if (targetWidgetId !== appId || action !== 'rpg-stats:level-up') return
      setLevel((l) => l + 1)
      setStats((prev) => Object.fromEntries(STAT_KEYS.map((k) => [k, prev[k] + 2])) as typeof prev)
    })
  }, [appId])

  return (
    <DesktopWindow
      id={appId}
      title="🛡️ Character Sheet"
      width={260}
      defaultPosition={{ x: 60, y: 400 }}
      zIndex={zIndex}
      state={windowState}
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
      bodyStyle={{ padding: 12, fontFamily: 'VT323, monospace' }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 22, color: '#c9a24b' }}>LEVEL {level}</div>
        {STAT_KEYS.map((key) => (
          <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 17 }}>
            <span style={{ opacity: 0.75 }}>{key}</span>
            <span>{stats[key]}</span>
          </div>
        ))}
      </div>
    </DesktopWindow>
  )
}
