import { useEffect, useRef, useState } from 'react'
import { DesktopWindow } from './DesktopWindow'

interface CombatLogWidgetProps {
  appId?: string
  onClose: () => void
  onMinimize?: () => void
  onFocus?: () => void
  windowState?: 'open' | 'closing'
  zIndex?: number
}

interface LogLine { id: number; text: string; color: string }

const TEMPLATES: Array<[string, string]> = [
  ['[System] {u} joined the raid.', '#ffd94a'],
  ['{u} dealt {n} damage with HYPE!', '#ff6b6b'],
  ['{u} cast Follow — +50 XP gained!', '#4d96ff'],
  ['Critical Hit! {u} lands a Clip That!', '#ff9f43'],
  ['{u} looted a Subscription (Rare)!', '#c586ff'],
  ['You gained {n} XP from chat activity.', '#6bcb77'],
  ['{u} used Raid — party healed for {n}!', '#6bcb77'],
]

const USERNAMES = ['Xx_Raider_xX', 'Lootgoblin', 'ChampMain', 'ShadowByte', 'PixelKnight']

/** COMBAT-LOG-WIDGET — desktop-window version of the MMO combat log, always chattering in the background. */
export function CombatLogWidget({
  appId = 'combat-log-widget',
  onClose,
  onMinimize,
  onFocus,
  windowState = 'open',
  zIndex,
}: CombatLogWidgetProps) {
  const [lines, setLines] = useState<LogLine[]>([])
  const idRef = useRef(0)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const fire = () => {
      const [tpl, color] = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)]
      const text = tpl
        .replace('{u}', USERNAMES[Math.floor(Math.random() * USERNAMES.length)])
        .replace('{n}', String(Math.floor(20 + Math.random() * 480)))
      setLines((prev) => [...prev, { id: ++idRef.current, text, color }].slice(-14))
      timer = setTimeout(fire, 2800 * (0.5 + Math.random()))
    }
    timer = setTimeout(fire, 1200)
    return () => clearTimeout(timer)
  }, [])

  return (
    <DesktopWindow
      id={appId}
      title="⚔️ Combat Log"
      width={320}
      height={240}
      defaultPosition={{ x: 1200, y: 420 }}
      zIndex={zIndex}
      state={windowState}
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
      bodyStyle={{ padding: '8px 10px', overflow: 'hidden', background: '#0a0804' }}
    >
      <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: 2, height: '100%', overflow: 'hidden', fontFamily: 'VT323, monospace' }}>
        {[...lines].reverse().map((l) => (
          <div key={l.id} style={{ fontSize: 15, color: l.color, lineHeight: 1.3 }}>{l.text}</div>
        ))}
      </div>
    </DesktopWindow>
  )
}
