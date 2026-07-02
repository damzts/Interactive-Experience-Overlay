import { useEffect, useRef, useState } from 'react'
import { DesktopWindow } from './DesktopWindow'

interface RetroMessengerWidgetProps {
  appId?: string
  onClose: () => void
  onMinimize?: () => void
  onFocus?: () => void
  windowState?: 'open' | 'closing'
  zIndex?: number
}

interface Contact { name: string; status: 'online' | 'away' | 'busy' | 'offline' }

const CONTACTS: Contact[] = [
  { name: 'xXDarkAngelXx', status: 'online' },
  { name: 'CoolGuy2004', status: 'away' },
  { name: 'sk8rgrl99', status: 'online' },
  { name: 'MoonlightWolf', status: 'busy' },
  { name: 'Pr0GamerX', status: 'offline' },
  { name: 'GlitterKitten', status: 'online' },
]

const NUDGES = ['sent you a nudge!', 'is typing...', 'says: brb', 'says: check the stream lol', 'changed their status message']

const STATUS_COLOR: Record<Contact['status'], string> = {
  online: '#3fae4a', away: '#e2b93a', busy: '#c9432f', offline: '#8a8a8a',
}

/** RETRO-MESSENGER — AIM/MSN-style buddy list with fake contacts and idle chatter. */
export function RetroMessengerWidget({
  appId = 'retro-messenger',
  onClose,
  onMinimize,
  onFocus,
  windowState = 'open',
  zIndex,
}: RetroMessengerWidgetProps) {
  const [toast, setToast] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    const fire = () => {
      const contact = CONTACTS[Math.floor(Math.random() * CONTACTS.length)]
      if (contact.status !== 'offline') {
        const msg = NUDGES[Math.floor(Math.random() * NUDGES.length)]
        setToast(`${contact.name} ${msg}`)
        setTimeout(() => setToast(null), 3200)
      }
      timerRef.current = setTimeout(fire, 9000 * (0.6 + Math.random()))
    }
    timerRef.current = setTimeout(fire, 4000)
    return () => clearTimeout(timerRef.current)
  }, [])

  return (
    <DesktopWindow
      id={appId}
      title="💬 Buddy List"
      width={260}
      height={320}
      defaultPosition={{ x: 1560, y: 420 }}
      zIndex={zIndex}
      state={windowState}
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
      bodyStyle={{ padding: 0 }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: 'Tahoma, Verdana, Arial, sans-serif', fontSize: 12 }}>
        <div style={{ background: 'linear-gradient(180deg,#f0f4a0,#d8e060)', padding: '4px 8px', borderBottom: '1px solid #999', fontWeight: 'bold' }}>
          Buddies ({CONTACTS.filter((c) => c.status !== 'offline').length}/{CONTACTS.length})
        </div>
        <div style={{ flex: 1, overflow: 'auto', background: '#fff' }}>
          {CONTACTS.map((c) => (
            <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderBottom: '1px solid #eee', opacity: c.status === 'offline' ? 0.5 : 1 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[c.status], flexShrink: 0 }} />
              <span>{c.name}</span>
            </div>
          ))}
        </div>
        {toast && (
          <div style={{ padding: '6px 8px', background: '#fffbcc', borderTop: '1px solid #e0d060', fontSize: 11 }}>
            {toast}
          </div>
        )}
      </div>
    </DesktopWindow>
  )
}
