import { useEffect, useState } from 'react'
import { DesktopWindow } from './DesktopWindow'

interface Props {
  onClose: () => void
  onMinimize?: () => void
  onFocus?: () => void
  windowState?: 'open' | 'closing'
  zIndex?: number
}

const TRACKS = [
  '01. opener_mix.mp3',
  '02. city_night_loop.mp3',
  '03. chromedream_edit.mp3',
  '04. stream_breakbeat.mp3',
  '05. closing_theme.mp3',
]

export function PlaylistDeckWidget({ onClose, onMinimize, onFocus, windowState = 'open', zIndex }: Props) {
  const [selected, setSelected] = useState(1)
  const [elapsed, setElapsed] = useState(62)

  useEffect(() => {
    const id = window.setInterval(() => setElapsed((prev) => prev + 1), 1000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <DesktopWindow
      id="playlist-deck"
      title="Playlist Deck"
      width={300}
      defaultPosition={{ x: 284, y: 232 }}
      zIndex={zIndex}
      state={windowState}
      windowClassName="desktop-window--playlist"
      bodyClassName="desktop-window-body--playlist"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
      bodyStyle={{ padding: '12px' }}
    >
      <div className="widget-stack">
        <div className="widget-panel widget-panel--scroll widget-panel--terminal widget-playlist-list">
          {TRACKS.map((track, index) => (
            <button key={track} className={`widget-playlist-item${selected === index ? ' widget-playlist-item--active' : ''}`} onClick={() => setSelected(index)}>
              {track}
            </button>
          ))}
        </div>
        <div className="widget-meta-row">
          <span className="widget-led-accent">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}</span>
          <span className="widget-led-subtle">queue 5/18</span>
        </div>
      </div>
    </DesktopWindow>
  )
}