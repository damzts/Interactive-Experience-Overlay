import { useState, useEffect, useRef } from 'react'
import { DesktopWindow } from './DesktopWindow'
import { addWidgetSimulationIntentListener } from './widgetSimulationEvents'

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

  useEffect(() => {
    return addWidgetSimulationIntentListener((payload) => {
      if (payload.widgetId !== 'chat' || payload.kind !== 'chat:add-message') return
      setMessages((prev) => [...prev, payload.message])
    })
  }, [])

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
      windowClassName="desktop-window--chat"
      bodyClassName="desktop-window-body--chat"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
      bodyStyle={{ padding: '12px', display: 'flex', flexDirection: 'column' }}
    >
      <div className="widget-stack widget-stack--fill">
        <div
          ref={listRef}
          className="widget-panel widget-panel--scroll widget-chat-log"
        >
          {messages.map((m, i) => (
            <div key={i} className="widget-chat-message">
              <span style={{ color: m.color, fontWeight: 'bold' }}>{m.user}: </span>
              <span>{m.text}</span>
            </div>
          ))}
        </div>

        <div className="widget-input-row widget-input-row--chat">
          <input
            data-sim-action="chat-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSend() }}
            placeholder="Say something…"
            className="widget-text-input"
          />
          <button data-sim-action="chat-send" onClick={handleSend} className="widget-send-button">Send</button>
        </div>
      </div>
    </DesktopWindow>
  )
}
