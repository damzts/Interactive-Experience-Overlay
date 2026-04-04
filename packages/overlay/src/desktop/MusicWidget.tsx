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
    <div className="widget-vu-meter">
      {heights.map((h, i) => (
        <div key={i} className="widget-vu-meter-bar" style={{
          height: `${h}%`,
          background: BAR_COLORS[i],
          boxShadow: `0 0 6px ${BAR_COLORS[i]}88`,
        }} />
      ))}
    </div>
  )
}

/** Scrolling track-name marquee */
function TrackMarquee({ text }: { text: string }) {
  return (
    <div className="widget-track-marquee">
      <span className="widget-track-marquee-text" style={{ animation: text.length > 28 ? 'music-scroll 8s linear infinite' : 'none' }}>
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
        windowClassName="desktop-window--music"
        bodyClassName="desktop-window-body--music"
        onFocus={onFocus}
        onMinimize={onMinimize}
        onClose={onClose}
        bodyStyle={{ padding: '12px' }}
      >
        <div className="widget-stack">
          <div className="widget-panel widget-panel--display widget-panel--music-display">
            <div className="widget-led-copy">NOW PLAYING</div>
            <TrackMarquee text="lo-fi beats to stream to — track 01" />
            <div className="widget-meta-row">
              <span className="widget-led-accent">{fmt(elapsed)}</span>
              <VUBar />
            </div>
          </div>
          <div className="widget-toolbar widget-toolbar--music">
            {[['|◀', 'music-prev'], ['■', 'music-stop'], ['▶', 'music-play'], ['▶|', 'music-next'], ['↺', 'music-loop']].map(([label, simAction], i) => (
              <button key={i} data-sim-action={simAction} className="widget-toolbar-button">{label}</button>
            ))}
          </div>
          <div className="widget-input-row">
            <span className="widget-label">Volume</span>
            <input type="range" min={0} max={100} defaultValue={70} className="widget-slider" />
          </div>
        </div>
      </DesktopWindow>
    </>
  )
}
