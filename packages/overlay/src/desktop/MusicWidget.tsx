import { useState, useEffect } from 'react'
import { DesktopWindow } from './DesktopWindow'
import { addWidgetSimulationIntentListener, dispatchWidgetSignal, addWidgetChainActionListener } from './widgetSimulationEvents'

const TRACKS = [
  'lo-fi beats to stream to — track 01',
  'night drive cassette — track 02',
  'signal bloom — track 03',
] as const

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
  appId: string
  onClose: () => void
  onMinimize?: () => void
  onFocus?: () => void
  windowState?: 'open' | 'closing'
  zIndex?: number
}

export function MusicWidget({ appId, onClose, onMinimize, onFocus, windowState = 'open', zIndex }: Props) {
  const [elapsed, setElapsed] = useState(0)
  const [trackIndex, setTrackIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)

  useEffect(() => {
    if (!isPlaying) return
    const id = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(id)
  }, [isPlaying])

  const runTransportAction = (action: 'music:prev' | 'music:play-pause' | 'music:next') => {
    if (action === 'music:play-pause') {
      setIsPlaying((prev) => {
        const next = !prev
        dispatchWidgetSignal({ source: appId, event: next ? 'music:play' : 'music:pause' })
        return next
      })
      return
    }

    setTrackIndex((prev) => {
      const next = action === 'music:prev'
        ? (prev - 1 + TRACKS.length) % TRACKS.length
        : (prev + 1) % TRACKS.length
      dispatchWidgetSignal({ source: appId, event: 'music:track-changed', payload: { track: TRACKS[next] } })
      return next
    })
    setElapsed(0)
    setIsPlaying(true)
  }

  useEffect(() => {
    return addWidgetSimulationIntentListener((payload) => {
      if (payload.widgetId !== appId) return
      if (payload.kind === 'music:prev' || payload.kind === 'music:play-pause' || payload.kind === 'music:next') {
        runTransportAction(payload.kind)
      }
    })
  }, [appId])

  useEffect(() => {
    return addWidgetChainActionListener(({ targetWidgetId, action }) => {
      if (targetWidgetId !== appId) return
      if (action === 'music:prev' || action === 'music:play-pause' || action === 'music:next') {
        runTransportAction(action)
      }
    })
  }, [appId])

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
            <TrackMarquee text={TRACKS[trackIndex]} />
            <div className="widget-meta-row">
              <span className="widget-led-accent">{fmt(elapsed)}</span>
              <VUBar />
            </div>
          </div>
          <div className="widget-toolbar widget-toolbar--music">
            {[['|◀', 'music-prev'], ['■', 'music-play'], ['▶', 'music-play'], ['▶|', 'music-next'], ['↺', 'music-loop']].map(([label, simAction], i) => (
              <button
                key={i}
                data-sim-action={simAction}
                className="widget-toolbar-button"
                onClick={() => {
                  if (simAction === 'music-prev') runTransportAction('music:prev')
                  if (simAction === 'music-play') runTransportAction('music:play-pause')
                  if (simAction === 'music-next') runTransportAction('music:next')
                }}
              >
                {label}
              </button>
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
