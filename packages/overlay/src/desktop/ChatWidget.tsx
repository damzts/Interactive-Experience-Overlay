import { useState, useEffect, useRef } from 'react'
import { DesktopWindow } from './DesktopWindow'

interface Message {
  user: string
  text: string
  color: string
}

const SEED_MESSAGES: Message[] = [
  { user: 'xXProGamer99', text: 'what game are you playing?', color: '#ff6b6b' },
  { user: 'StreamFan42',  text: 'PogChamp',                  color: '#69db7c' },
  { user: 'lurker_mode',  text: 'first time watching, love the setup', color: '#74c0fc' },
  { user: 'RetroViewer',  text: 'this overlay is sick',      color: '#da77f2' },
]

interface Props {
  onClose: () => void
  onMinimize?: () => void
  onFocus?: () => void
  windowState?: 'open' | 'closing'
  zIndex?: number
}

export function ChatWidget({ onClose, onMinimize, onFocus, windowState = 'open', zIndex }: Props) {
  const [messages, setMessages] = useState<Message[]>(SEED_MESSAGES)
  const [input, setInput]     = useState('')
  const listRef               = useRef<HTMLDivElement>(null)

  // Auto-scroll on new messages
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages])

  const handleSend = () => {
    const txt = input.trim()
    if (!txt) return
    setMessages((prev) => [...prev, { user: 'You', text: txt, color: '#ffd43b' }])
    setInput('')
  }

  return (
    <DesktopWindow
      id="chat"
      title="💬 Chat.exe"
      width={280}
      defaultPosition={{ x: 1580, y: 60 }}
      zIndex={zIndex}
      state={windowState}
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
      bodyStyle={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}
    >
        {/* Message list */}
        <div
          ref={listRef}
          style={{
            background: '#fff',
            border: '2px inset',
            height: 200,
            overflowY: 'auto',
            padding: '4px 6px',
            fontFamily: 'MS Sans Serif, Arial, sans-serif',
            fontSize: 11,
          }}
        >
          {messages.map((m, i) => (
            <div key={i} style={{ marginBottom: 3, lineHeight: 1.4 }}>
              <span style={{ color: m.color, fontWeight: 'bold' }}>{m.user}: </span>
              <span style={{ color: '#000' }}>{m.text}</span>
            </div>
          ))}
        </div>

        {/* Input row */}
        <div style={{ display: 'flex', gap: 4 }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSend() }}
            placeholder="Say something…"
            style={{ flex: 1, fontFamily: 'MS Sans Serif, Arial, sans-serif', fontSize: 11 }}
          />
          <button onClick={handleSend} style={{ fontFamily: 'MS Sans Serif, Arial, sans-serif', fontSize: 11 }}>Send</button>
        </div>
    </DesktopWindow>
  )
}
