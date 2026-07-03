import { useEffect, useRef, useState } from 'react'
import type { RendererProps } from '../registry'

interface Contact { name: string; status: 'online' | 'away' | 'busy' | 'offline' }

const DEFAULT_CONTACTS: Contact[] = [
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

/** RETRO-MESSENGER — AIM/MSN-style buddy list with fake contacts and idle chatter.
 *  Emits `messenger:nudge` when a buddy pipes up; accepts `messenger:say`
 *  (payload.text) from automation rules to show a custom toast. */
export function RetroMessengerRenderer({ config, emit, onSignal, instanceId }: RendererProps) {
  const intervalMs = Number(config.intervalMs ?? 9000)
  const buddyNames = (config.buddies as string[] | undefined)
  const contacts: Contact[] = buddyNames?.length
    ? buddyNames.map((name, i) => ({ name, status: (['online', 'away', 'busy', 'online'] as const)[i % 4] }))
    : DEFAULT_CONTACTS

  const [toast, setToast] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const toastTimerRef = useRef<ReturnType<typeof setTimeout>>()

  const showToast = (text: string) => {
    setToast(text)
    clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(null), 3200)
  }

  useEffect(() => {
    const fire = () => {
      const contact = contacts[Math.floor(Math.random() * contacts.length)]
      if (contact.status !== 'offline') {
        const msg = NUDGES[Math.floor(Math.random() * NUDGES.length)]
        showToast(`${contact.name} ${msg}`)
        emit('signal', { source: instanceId, event: 'messenger:nudge', payload: { buddy: contact.name } })
      }
      timerRef.current = setTimeout(fire, intervalMs * (0.6 + Math.random()))
    }
    timerRef.current = setTimeout(fire, 4000)
    return () => {
      clearTimeout(timerRef.current)
      clearTimeout(toastTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, contacts.map((c) => c.name).join(',')])

  useEffect(() => {
    return onSignal('action', (data) => {
      const detail = data as { targetWidgetId: string; action: string; sourceSignal?: { payload?: unknown } }
      if (detail.targetWidgetId !== instanceId) return
      if (detail.action === 'messenger:say') {
        const text = (detail.sourceSignal?.payload as { text?: unknown } | undefined)?.text
        showToast(typeof text === 'string' && text ? text : 'New message!')
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instanceId])

  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      fontFamily: 'Tahoma, Verdana, Arial, sans-serif', fontSize: 12,
      border: '1px solid #999', background: '#fff', overflow: 'hidden', pointerEvents: 'none',
    }}>
      <div style={{ background: 'linear-gradient(180deg,#f0f4a0,#d8e060)', padding: '4px 8px', borderBottom: '1px solid #999', fontWeight: 'bold', color: '#333' }}>
        Buddies ({contacts.filter((c) => c.status !== 'offline').length}/{contacts.length})
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {contacts.map((c) => (
          <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderBottom: '1px solid #eee', color: '#222', opacity: c.status === 'offline' ? 0.5 : 1 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[c.status], flexShrink: 0 }} />
            <span>{c.name}</span>
          </div>
        ))}
      </div>
      {toast && (
        <div style={{ padding: '6px 8px', background: '#fffbcc', borderTop: '1px solid #e0d060', fontSize: 11, color: '#333' }}>
          {toast}
        </div>
      )}
    </div>
  )
}
