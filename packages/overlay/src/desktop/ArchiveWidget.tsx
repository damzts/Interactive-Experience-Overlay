import { useState, useEffect, useRef } from 'react'
import { socket } from '../socket/client'
import { STATE } from '@ieom/shared'
import { useAppStore } from '../store/useAppStore'

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

export function ArchiveWidget() {
  const visualState = useAppStore((st) => st.visualState)
  const dragRef     = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: 900, y: 120 })
  const dragging    = useRef(false)
  const offset      = useRef({ x: 0, y: 0 })
  const sessionTime = useSessionTimer()

  // Track last 8 state transitions
  const [log, setLog] = useState<{ state: string; time: string }[]>([
    { state: 'DESKTOP', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) },
  ])

  useEffect(() => {
    const t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setLog((prev) => [{ state: String(visualState), time: t }, ...prev].slice(0, 8))
  }, [visualState])

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true
    offset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }
    e.preventDefault()
  }
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return
      setPos({ x: e.clientX - offset.current.x, y: e.clientY - offset.current.y })
    }
    const onUp = () => { dragging.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  const handleClose = () => {
    socket.emit('scene:change', STATE.DESKTOP)
  }

  const now = new Date()
  const dateStr = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div
      ref={dragRef}
      className="window"
      style={{
        position: 'absolute',
        left: pos.x,
        top: pos.y,
        width: 300,
        boxShadow: '4px 4px 0 #000',
        userSelect: 'none',
        zIndex: 10,
      }}
    >
      <div
        className="title-bar"
        style={{ cursor: 'move' }}
        onMouseDown={onMouseDown}
      >
        <div className="title-bar-text">📁 ARCHIVE.exe</div>
        <div className="title-bar-controls">
          <button aria-label="Minimize" />
          <button aria-label="Maximize" />
          <button aria-label="Close" onClick={handleClose} />
        </div>
      </div>

      <div className="window-body" style={{ padding: '8px 10px' }}>
        {/* Session info */}
        <div
          style={{
            background: '#000',
            border: '2px inset',
            padding: '6px 8px',
            marginBottom: 8,
            fontFamily: 'VT323, monospace',
            fontSize: 13,
            color: '#00aaff',
            lineHeight: 1.6,
          }}
        >
          <div>SESSION ACTIVE</div>
          <div style={{ color: '#fff' }}>{dateStr}</div>
          <div>
            UPTIME: <span style={{ color: '#00ff88' }}>{sessionTime}</span>
          </div>
          <div>
            STATE:{' '}
            <span style={{ color: '#ffaa00' }}>{String(visualState)}</span>
          </div>
        </div>

        {/* State log */}
        <div style={{ marginBottom: 4, fontFamily: 'MS Sans Serif, Arial', fontSize: 11, fontWeight: 'bold' }}>
          State Log:
        </div>
        <div
          style={{
            background: '#fff',
            border: '2px inset',
            height: 120,
            overflowY: 'auto',
            padding: '2px 4px',
            fontFamily: 'VT323, monospace',
            fontSize: 12,
          }}
        >
          {log.map((entry, i) => (
            <div key={i} style={{ color: i === 0 ? '#000080' : '#666', lineHeight: 1.4 }}>
              [{entry.time}] {entry.state}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
