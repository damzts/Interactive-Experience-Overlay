import { useState, useEffect, useRef } from 'react'
import { DesktopWindow } from './DesktopWindow'

/** Animated VU bar — 8 vertical bars that bounce independently */
function VUBar() {
  const [heights, setHeights] = useState(() => Array.from({ length: 8 }, () => 20))
  useEffect(() => {
    const id = setInterval(() => {
      setHeights((prev) =>
        prev.map((h) => Math.max(8, Math.min(100, h + (Math.random() - 0.5) * 30))),
      )
    }, 100)
    return () => clearInterval(id)
  }, [])
  const BAR_COLORS = ['#00ff88', '#00ff88', '#00cc66', '#00aa44', '#ffaa00', '#ff6600', '#ff3300', '#ff0000']
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 32, padding: '0 2px' }}>
      {heights.map((h, i) => (
        <div key={i} style={{
          width: 8, height: `${h}%`,
          background: BAR_COLORS[i],
          transition: 'height 0.1s ease',
          boxShadow: `0 0 4px ${BAR_COLORS[i]}88`,
        }} />
      ))}
    </div>
  )
}

/** Scrolling track-name marquee */
function TrackMarquee({ text }: { text: string }) {
  return (
    <div style={{ overflow: 'hidden', width: '100%', position: 'relative', height: 18 }}>
      <span style={{
        display: 'inline-block',
        whiteSpace: 'nowrap',
        fontFamily: 'MS Sans Serif, Arial, sans-serif',
        fontSize: 12,
        color: '#000080',
        animation: text.length > 28 ? 'music-scroll 8s linear infinite' : 'none',
      }}>
        {text}
      </span>
    </div>
  )
}

interface Props {
  onClose: () => void
  onMinimize?: () => void
  onFocus?: () => void
  windowState?: 'open' | 'closing'
  zIndex?: number
}

export function MusicWidget({ onClose, onMinimize, onFocus, windowState = 'open', zIndex }: Props) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  return (
    <>
      <style>{`@keyframes music-scroll { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }`}</style>
      <DesktopWindow
        id="music"
        title="🎵 MUSIC.exe"
        width={280}
        defaultPosition={{ x: 60, y: 120 }}
        zIndex={zIndex}
        state={windowState}
        onFocus={onFocus}
        onMinimize={onMinimize}
        onClose={onClose}
        bodyStyle={{ padding: '8px 10px' }}
      >
          <div style={{ background: '#000', border: '2px inset', padding: '6px 8px', marginBottom: 8, minHeight: 52 }}>
            <div style={{ fontFamily: 'VT323, monospace', fontSize: 11, color: '#00ff88', marginBottom: 2 }}>NOW PLAYING</div>
            <TrackMarquee text="lo-fi beats to stream to — track 01" />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <span style={{ fontFamily: 'VT323, monospace', fontSize: 13, color: '#00ff88' }}>{fmt(elapsed)}</span>
              <VUBar />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginBottom: 8 }}>
            {[['|◀', 'music-prev'], ['■', 'music-stop'], ['▶', 'music-play'], ['▶|', 'music-next'], ['↺', 'music-loop']].map(([label, simAction], i) => (
              <button key={i} data-sim-action={simAction} style={{ width: 30, height: 22, fontFamily: 'Arial', fontSize: 11, cursor: 'pointer' }}>{label}</button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: 'MS Sans Serif, Arial', fontSize: 11, width: 44 }}>Volume:</span>
            <input type="range" min={0} max={100} defaultValue={70} style={{ flex: 1, height: 16 }} />
          </div>
      </DesktopWindow>
    </>
  )
}
