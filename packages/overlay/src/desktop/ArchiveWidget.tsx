import { useState, useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
import { DesktopWindow } from './DesktopWindow'

function useSessionTimer() {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [])
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

interface Props {
  onClose: () => void
  onMinimize?: () => void
  onFocus?: () => void
  windowState?: 'open' | 'closing'
  zIndex?: number
}

export function ArchiveWidget({ onClose, onMinimize, onFocus, windowState = 'open', zIndex }: Props) {
  const visualState = useAppStore((st) => st.visualState)
  const sessionTime = useSessionTimer()

  const [log, setLog] = useState<{ state: string; time: string }[]>([
    { state: String(visualState), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) },
  ])

  useEffect(() => {
    const t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setLog((prev) => [{ state: String(visualState), time: t }, ...prev].slice(0, 8))
  }, [visualState])

  const now = new Date()
  const dateStr = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <DesktopWindow
      id="archive"
      title="📖 ARCHIVE.exe"
      width={300}
      defaultPosition={{ x: 900, y: 120 }}
      zIndex={zIndex}
      state={windowState}
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
      bodyStyle={{ padding: '8px 10px' }}
    >
        <div style={{ background: '#000', border: '2px inset', padding: '6px 8px', marginBottom: 8, fontFamily: 'VT323, monospace', fontSize: 13, color: '#00aaff', lineHeight: 1.6 }}>
          <div>SESSION ACTIVE</div>
          <div style={{ color: '#fff' }}>{dateStr}</div>
          <div>UPTIME: <span style={{ color: '#00ff88' }}>{sessionTime}</span></div>
          <div>STATE: <span style={{ color: '#ffaa00' }}>{String(visualState)}</span></div>
        </div>
        <div style={{ marginBottom: 4, fontFamily: 'MS Sans Serif, Arial', fontSize: 11, fontWeight: 'bold' }}>State Log:</div>
        <div style={{ background: '#fff', border: '2px inset', height: 120, overflowY: 'auto', padding: '2px 4px', fontFamily: 'VT323, monospace', fontSize: 12 }}>
          {log.map((entry, i) => (
            <div key={i} data-sim-action="archive-log" style={{ color: i === 0 ? '#000080' : '#666', lineHeight: 1.4 }}>
              [{entry.time}] {entry.state}
            </div>
          ))}
        </div>
    </DesktopWindow>
  )
}
