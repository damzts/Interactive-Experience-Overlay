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
      windowClassName="desktop-window--archive"
      bodyClassName="desktop-window-body--archive"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
      bodyStyle={{ padding: '12px' }}
    >
      <div className="widget-stack">
        <div className="widget-panel widget-panel--display widget-panel--archive-hero">
          <div className="widget-led-copy">SESSION ACTIVE</div>
          <div className="widget-led-subtle">{dateStr}</div>
          <div className="widget-led-row">UPTIME <span className="widget-led-accent">{sessionTime}</span></div>
          <div className="widget-led-row">STATE <span className="widget-led-warn">{String(visualState)}</span></div>
        </div>
        <div className="widget-section-title">State Log</div>
        <div className="widget-panel widget-panel--scroll widget-panel--terminal">
          {log.map((entry, i) => (
            <div key={i} data-sim-action="archive-log" className={`widget-log-entry ${i === 0 ? 'widget-log-entry--active' : ''}`}>
              [{entry.time}] {entry.state}
            </div>
          ))}
        </div>
      </div>
    </DesktopWindow>
  )
}
