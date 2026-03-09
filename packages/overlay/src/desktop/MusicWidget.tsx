import { useState, useEffect, useRef } from 'react'
import { socket } from '../socket/client'
import { STATE } from '@ieom/shared'

/** Animated VU bar — 8 vertical bars that bounce independently */
function VUBar() {
  const [heights, setHeights] = useState(() => Array.from({ length: 8 }, () => 20))

  useEffect(() => {
    const id = setInterval(() => {
      setHeights((prev) =>
        prev.map((h) => {
          const delta = (Math.random() - 0.5) * 30
          return Math.max(8, Math.min(100, h + delta))
        }),
      )
    }, 100)
    return () => clearInterval(id)
  }, [])

  const barColors = ['#00ff88', '#00ff88', '#00cc66', '#00aa44', '#ffaa00', '#ff6600', '#ff3300', '#ff0000']

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 32, padding: '0 2px' }}>
      {heights.map((h, i) => (
        <div
          key={i}
          style={{
            width: 8,
            height: `${h}%`,
            background: barColors[Math.min(i, barColors.length - 1)],
            transition: 'height 0.1s ease',
            boxShadow: `0 0 4px ${barColors[Math.min(i, barColors.length - 1)]}88`,
          }}
        />
      ))}
    </div>
  )
}

/** Scrolling track name marquee */
function TrackMarquee({ text }: { text: string }) {
  return (
    <div style={{ overflow: 'hidden', width: '100%', position: 'relative', height: 18 }}>
      <span
        style={{
          display: 'inline-block',
          whiteSpace: 'nowrap',
          fontFamily: 'MS Sans Serif, Arial, sans-serif',
          fontSize: 12,
          color: '#000080',
          animation: text.length > 28 ? 'music-scroll 8s linear infinite' : 'none',
        }}
      >
        {text}
      </span>
    </div>
  )
}

export function MusicWidget() {
  const dragRef     = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: 60, y: 120 })
  const dragging    = useRef(false)
  const offset      = useRef({ x: 0, y: 0 })

  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${String(sec).padStart(2, '0')}`
  }

  // Drag handlers
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

  return (
    <>
      <style>{`
        @keyframes music-scroll {
          0%   { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>

      <div
        ref={dragRef}
        className="window"
        style={{
          position: 'absolute',
          left: pos.x,
          top: pos.y,
          width: 280,
          boxShadow: '4px 4px 0 #000',
          userSelect: 'none',
          zIndex: 10,
        }}
      >
        {/* Title bar */}
        <div
          className="title-bar"
          style={{ cursor: 'move' }}
          onMouseDown={onMouseDown}
        >
          <div className="title-bar-text">🎵 MUSIC.exe</div>
          <div className="title-bar-controls">
            <button aria-label="Minimize" />
            <button aria-label="Maximize" />
            <button aria-label="Close" onClick={handleClose} />
          </div>
        </div>

        {/* Window body */}
        <div className="window-body" style={{ padding: '8px 10px' }}>
          {/* Track display */}
          <div
            style={{
              background: '#000',
              border: '2px inset',
              padding: '6px 8px',
              marginBottom: 8,
              minHeight: 52,
            }}
          >
            <div style={{ fontFamily: 'VT323, monospace', fontSize: 11, color: '#00ff88', marginBottom: 2 }}>
              NOW PLAYING
            </div>
            <TrackMarquee text="lo-fi beats to stream to — track 01" />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <span style={{ fontFamily: 'VT323, monospace', fontSize: 13, color: '#00ff88' }}>
                {formatTime(elapsed)}
              </span>
              <VUBar />
            </div>
          </div>

          {/* Transport controls */}
          <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginBottom: 8 }}>
            {['⏮', '⏪', '⏸', '⏩', '⏭'].map((label, i) => (
              <button
                key={i}
                style={{
                  width: 30,
                  height: 22,
                  fontFamily: 'Arial',
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Volume slider row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: 'MS Sans Serif, Arial', fontSize: 11, width: 44 }}>Volume:</span>
            <input
              type="range"
              min={0}
              max={100}
              defaultValue={70}
              style={{ flex: 1, height: 16 }}
            />
          </div>
        </div>
      </div>
    </>
  )
}
