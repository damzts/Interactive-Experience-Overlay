import { useEffect, useRef, useState } from 'react'
import type { RendererProps } from '../registry'

interface ChatMsg {
  id: number
  username: string
  text: string
  color: string
}

const USERNAME_COLORS = ['#ff6b6b','#ffd93d','#6bcb77','#4d96ff','#ff6dd9','#c5baff','#ff9f43']

export function ChatSimulatorRenderer({ config }: RendererProps) {
  const usernames = (config.usernames as string[] | undefined) ?? ['xX_Pro_Xx','gamer123','lurker99','StreamFan','NightOwl','Kappa','weirdChamp']
  const messages  = (config.messages  as string[] | undefined) ?? [
    'PogChamp', 'nice', 'lets gooo', 'lmao', 'clutch!!', 'gg', 'KEKW',
    'ez', 'monkaS', 'that was insane', 'W', 'no way', 'haha', 'bruh',
    'this is so good', 'first time watching, love it', 'omg',
  ]
  const intervalMs  = (config.intervalMs  as number  | undefined) ?? 2800
  const maxVisible  = (config.maxVisible  as number  | undefined) ?? 8
  const bgColor     = (config.bgColor     as string  | undefined) ?? 'rgba(0,0,0,0.65)'
  const fontSize    = (config.fontSize    as number  | undefined) ?? 14

  const [msgs, setMsgs]   = useState<ChatMsg[]>([])
  const counterRef = useRef(0)

  useEffect(() => {
    const jitter = () => intervalMs * (0.6 + Math.random() * 0.8)

    const fire = () => {
      const username = usernames[Math.floor(Math.random() * usernames.length)]
      const text     = messages[Math.floor(Math.random() * messages.length)]
      const color    = USERNAME_COLORS[Math.floor(Math.random() * USERNAME_COLORS.length)]
      setMsgs(prev => {
        const next = [...prev, { id: ++counterRef.current, username, text, color }]
        return next.slice(-maxVisible)
      })
      timer = setTimeout(fire, jitter())
    }

    let timer = setTimeout(fire, jitter())
    return () => clearTimeout(timer)
  }, [usernames, messages, intervalMs, maxVisible])

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        padding: '8px 10px',
        background: bgColor,
        borderRadius: 4,
        overflow: 'hidden',
        fontFamily: 'Inter,Arial,sans-serif',
      }}
    >
      {msgs.map(m => (
        <div
          key={m.id}
          style={{
            fontSize,
            lineHeight: 1.4,
            marginTop: 2,
            wordBreak: 'break-word',
          }}
        >
          <span style={{ color: m.color, fontWeight: 700 }}>{m.username}: </span>
          <span style={{ color: '#e0e0e0' }}>{m.text}</span>
        </div>
      ))}
    </div>
  )
}
