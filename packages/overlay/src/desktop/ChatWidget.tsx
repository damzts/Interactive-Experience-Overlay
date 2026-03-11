import { useState, useEffect, useRef } from 'react'

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

interface Props { onClose: () => void }

export function ChatWidget({ onClose }: Props) {
  const [pos, setPos]         = useState({ x: 1580, y: 60 })
  const [messages, setMessages] = useState<Message[]>(SEED_MESSAGES)
  const [input, setInput]     = useState('')
  const listRef               = useRef<HTMLDivElement>(null)
  const dragging              = useRef(false)
  const offset                = useRef({ x: 0, y: 0 })
  const posRef                = useRef(pos)

  // Auto-scroll on new messages
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages])

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true
    offset.current = { x: e.clientX - posRef.current.x, y: e.clientY - posRef.current.y }
    e.preventDefault()
  }

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return
      const next = { x: e.clientX - offset.current.x, y: e.clientY - offset.current.y }
      posRef.current = next
      setPos(next)
    }
    const onUp = () => { dragging.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  const handleSend = () => {
    const txt = input.trim()
    if (!txt) return
    setMessages((prev) => [...prev, { user: 'You', text: txt, color: '#ffd43b' }])
    setInput('')
  }

  return (
    <div
      className="window"
      style={{ position: 'absolute', left: pos.x, top: pos.y, width: 280, userSelect: 'none', zIndex: 50, boxShadow: '4px 4px 0 #000' }}
    >
      <div className="title-bar" style={{ cursor: 'move' }} onMouseDown={onMouseDown}>
        <div className="title-bar-text">💬 Chat.exe</div>
        <div className="title-bar-controls">
          <button aria-label="Minimize" />
          <button aria-label="Maximize" />
          <button aria-label="Close" onClick={onClose} />
        </div>
      </div>

      <div className="window-body" style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
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
      </div>
    </div>
  )
}
