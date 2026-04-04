import { useEffect, useState } from 'react'
import { DesktopWindow } from './DesktopWindow'

interface Props {
  onClose: () => void
  onMinimize?: () => void
  onFocus?: () => void
  windowState?: 'open' | 'closing'
  zIndex?: number
}

const SPOTIFY_SOURCES = [
  {
    title: 'Night Drive',
    subtitle: 'Spotify Editorial',
    type: 'playlist',
    id: '37i9dQZF1DX6GwdWRQMQpq',
    href: 'https://open.spotify.com/playlist/37i9dQZF1DX6GwdWRQMQpq',
  },
  {
    title: 'Electronic Rising',
    subtitle: 'Spotify Editorial',
    type: 'playlist',
    id: '37i9dQZF1DX4dyzvuaRJ0n',
    href: 'https://open.spotify.com/playlist/37i9dQZF1DX4dyzvuaRJ0n',
  },
  {
    title: 'Brain Food',
    subtitle: 'Focus Mix',
    type: 'playlist',
    id: '37i9dQZF1DWZeKCadgRdKQ',
    href: 'https://open.spotify.com/playlist/37i9dQZF1DWZeKCadgRdKQ',
  },
] as const

function VUBar() {
  const [heights, setHeights] = useState(() => Array.from({ length: 8 }, () => 24))

  useEffect(() => {
    const id = window.setInterval(() => {
      setHeights((prev) => prev.map((value) => Math.max(10, Math.min(100, value + (Math.random() - 0.5) * 32))))
    }, 110)
    return () => window.clearInterval(id)
  }, [])

  const colors = ['#00ff88', '#00ff88', '#00cc66', '#00aa44', '#ffaa00', '#ff6600', '#ff3300', '#ff0000']

  return (
    <div className="widget-vu-meter">
      {heights.map((height, index) => (
        <div
          key={index}
          className="widget-vu-meter-bar"
          style={{
            height: `${height}%`,
            background: colors[index],
            boxShadow: `0 0 6px ${colors[index]}88`,
          }}
        />
      ))}
    </div>
  )
}

function TrackMarquee({ text }: { text: string }) {
  return (
    <div className="widget-track-marquee">
      <span className="widget-track-marquee-text" style={{ animation: text.length > 26 ? 'music-scroll 8s linear infinite' : 'none' }}>
        {text}
      </span>
    </div>
  )
}

export function MediaDeckWidget({ onClose, onMinimize, onFocus, windowState = 'open', zIndex }: Props) {
  const [selectedSource, setSelectedSource] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setElapsed((prev) => (isPlaying ? prev + 1 : prev))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [isPlaying])

  const selected = SPOTIFY_SOURCES[selectedSource]
  const timeLabel = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`
  const embedSrc = `https://open.spotify.com/embed/${selected.type}/${selected.id}?utm_source=generator&theme=0`

  return (
    <>
      <style>{`@keyframes music-scroll { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }`}</style>
      <DesktopWindow
        id="media-deck"
        title="Media Deck"
        width={320}
        defaultPosition={{ x: 188, y: 102 }}
        zIndex={zIndex}
        state={windowState}
        windowClassName="desktop-window--media-deck"
        bodyClassName="desktop-window-body--media-deck"
        onFocus={onFocus}
        onMinimize={onMinimize}
        onClose={onClose}
        bodyStyle={{ padding: '12px', minHeight: '420px', minWidth: 'min(320px, calc(100vw - 48px))' }}
      >
        <div className="widget-stack">
          <div className="widget-panel widget-panel--display widget-panel--media-simple-display">
            <div className="widget-led-copy">SPOTIFY DECK</div>
            <TrackMarquee text={`${selected.title} — ${selected.subtitle}`} />
            <div className="widget-meta-row">
              <span className="widget-led-accent">{timeLabel}</span>
              <VUBar />
            </div>
          </div>

          <div className="widget-media-simple-embed">
            <iframe
              title={`Spotify player for ${selected.title}`}
              src={embedSrc}
              width="100%"
              height="152"
              frameBorder="0"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
            />
          </div>

          <div className="widget-toolbar widget-toolbar--music widget-toolbar--media-deck-simple">
            <button type="button" className="widget-toolbar-button" onClick={() => setSelectedSource((prev) => (prev - 1 + SPOTIFY_SOURCES.length) % SPOTIFY_SOURCES.length)}>|◀</button>
            <button type="button" className="widget-toolbar-button" onClick={() => setIsPlaying(false)}>■</button>
            <button type="button" className="widget-toolbar-button" onClick={() => setIsPlaying(true)}>▶</button>
            <button type="button" className="widget-toolbar-button" onClick={() => setSelectedSource((prev) => (prev + 1) % SPOTIFY_SOURCES.length)}>▶|</button>
            <a className="widget-toolbar-button widget-toolbar-button--link" href={selected.href} target="_blank" rel="noreferrer">SP</a>
          </div>

          <div className="widget-media-simple-picker">
            {SPOTIFY_SOURCES.map((source, index) => (
              <button
                key={source.id}
                type="button"
                className={`widget-media-simple-item${selectedSource === index ? ' widget-media-simple-item--active' : ''}`}
                onClick={() => setSelectedSource(index)}
              >
                <span>{source.title}</span>
                <span>{source.subtitle}</span>
              </button>
            ))}
          </div>

          <div className="widget-input-row">
            <span className="widget-label">Volume</span>
            <input type="range" min={0} max={100} defaultValue={72} className="widget-slider" />
          </div>
        </div>
      </DesktopWindow>
    </>
  )
}