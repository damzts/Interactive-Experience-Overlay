import { useState, useEffect, useRef } from 'react'
import { DesktopWindow } from './DesktopWindow'
import { addWidgetSimulationIntentListener, dispatchWidgetSignal, addWidgetChainActionListener } from './widgetSimulationEvents'
import { socket } from '../socket/client'

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

export function ChatWidget({ appId, onClose, onMinimize, onFocus, windowState = 'open', zIndex }: Props & { appId: string }) {
  const [messages, setMessages] = useState<Message[]>(SEED_MESSAGES)
  const [input, setInput]     = useState('')
  const listRef               = useRef<HTMLDivElement>(null)

  // Auto-scroll on new messages
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages])

  useEffect(() => {
    return addWidgetSimulationIntentListener((payload) => {
      if (payload.widgetId !== appId || payload.kind !== 'chat:add-message') return
      setMessages((prev) => {
        dispatchWidgetSignal({ source: appId, event: 'chat:message', payload: { message: payload.message } })
        return [...prev, payload.message]
      })
    })
  }, [appId])

  useEffect(() => {
    return addWidgetChainActionListener(({ targetWidgetId, action }) => {
      if (targetWidgetId !== appId || action !== 'chat:add-message') return
      // chain actions don't carry a message payload — use a placeholder
      const msg = { user: 'chain', text: '(chain triggered)', color: '#aaa' }
      setMessages((prev) => [...prev, msg])
      dispatchWidgetSignal({ source: appId, event: 'chat:message', payload: { message: msg } })
    })
  }, [appId])

  // Real Twitch messages arrive via the typed chat:message signal
  useEffect(() => {
    const handleChatMessage = (payload: { user: string; text: string; color: string }) => {
      const msg: Message = { user: payload.user, text: payload.text, color: payload.color || '#ffffff' }
      setMessages((prev) => [...prev, msg])
      dispatchWidgetSignal({ source: appId, event: 'chat:message', payload: { message: msg } })
    }
    socket.on('chat:message', handleChatMessage)
    return () => { socket.off('chat:message', handleChatMessage) }
  }, [appId])

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
