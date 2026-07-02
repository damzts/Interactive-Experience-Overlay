import { useEffect, useRef, useState } from 'react'
import type { RendererProps } from '../registry'

interface LogLine { id: number; text: string; color: string }

const TEMPLATES: Array<[string, string]> = [
  ['[System] {u} joined the raid.', '#ffd94a'],
  ['{u} dealt {n} damage with HYPE!', '#ff6b6b'],
  ['{u} cast Follow — +50 XP gained!', '#4d96ff'],
  ['Critical Hit! {u} lands a Clip That!', '#ff9f43'],
  ['{u} looted a Subscription (Rare)!', '#c586ff'],
  ['You gained {n} XP from chat activity.', '#6bcb77'],
  ['{u} used Raid — party healed for {n}!', '#6bcb77'],
  ['{u} triggered a Boss Warning event!', '#ff4444'],
]

/** COMBAT-LOG — scrolling MMORPG-style combat log driven by (simulated) stream events. */
export function CombatLogRenderer({ config }: RendererProps) {
  const usernames  = (config.usernames as string[] | undefined) ?? ['Xx_Raider_xX', 'Lootgoblin', 'ChampMain', 'ShadowByte', 'PixelKnight']
  const intervalMs = Number(config.intervalMs ?? 3200)
  const maxLines   = Number(config.maxLines ?? 10)
  const fontSize   = Number(config.fontSize ?? 15)

  const [lines, setLines] = useState<LogLine[]>([])
  const idRef = useRef(0)

  useEffect(() => {
    const jitter = () => intervalMs * (0.5 + Math.random())
    let timer: ReturnType<typeof setTimeout>

    const fire = () => {
      const [tpl, color] = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)]
      const text = tpl
        .replace('{u}', usernames[Math.floor(Math.random() * usernames.length)])
        .replace('{n}', String(Math.floor(20 + Math.random() * 480)))
      setLines((prev) => [...prev, { id: ++idRef.current, text, color }].slice(-maxLines))
      timer = setTimeout(fire, jitter())
    }
    timer = setTimeout(fire, jitter())
    return () => clearTimeout(timer)
  }, [usernames.join(','), intervalMs, maxLines])

  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      justifyContent: 'flex-end', gap: 2, padding: '8px 10px',
      background: 'rgba(10,8,4,0.55)', border: '1px solid #4a3a20',
      fontFamily: 'VT323, monospace', overflow: 'hidden', pointerEvents: 'none',
    }}>
      {lines.map((l) => (
        <div key={l.id} style={{ fontSize, color: l.color, textShadow: '0 0 4px #000', lineHeight: 1.3 }}>
          {l.text}
        </div>
      ))}
    </div>
  )
}
