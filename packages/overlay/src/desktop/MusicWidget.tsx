import { useState, useEffect, useRef, useCallback } from 'react'
import { DesktopWindow } from './DesktopWindow'
import {
  addWidgetSimulationIntentListener,
  dispatchWidgetSignal,
  addWidgetChainActionListener,
} from './widgetSimulationEvents'
import { useAppStore } from '../store/useAppStore'

interface EmbedController {
  togglePlay(): void
  loadUri(uri: string): void
  addListener(event: 'playback_update', cb: (e: { data: { isPaused: boolean; position: number; duration: number } }) => void): void
  addListener(event: 'ready', cb: () => void): void
}

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: {
      createController(el: HTMLElement, opts: { uri: string }, cb: (ctrl: EmbedController) => void): void
    }) => void
    _spotifyApiLoaded?: boolean
  }
}

const BAR_COLORS = ['#00ff88', '#00ee77', '#00cc66', '#00aa44', '#ffcc00', '#ff8800', '#ff4400', '#ff0000']
const BAR_COUNT  = 12

function VUBar({ maxPx }: { maxPx: number }) {
  const [heights, setHeights] = useState(() => Array.from({ length: BAR_COUNT }, () => 14))
  useEffect(() => {
    const id = setInterval(() => {
      setHeights((prev) => prev.map((h) => Math.max(4, Math.min(maxPx, h + (Math.random() - 0.45) * (maxPx * 0.22)))))
    }, 90)
    return () => clearInterval(id)
  }, [maxPx])
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, width: '100%', height: '100%' }}>
      {heights.map((h, i) => {
        const color = BAR_COLORS[Math.floor(i / BAR_COUNT * BAR_COLORS.length)]
        return (
          <div key={i} style={{
            flex: 1,
            height: h,
            background: color,
            boxShadow: `0 0 8px ${color}99`,
            borderRadius: '3px 3px 2px 2px',
            transition: 'height 80ms ease',
          }} />
        )
      })}
    </div>
  )
}

function fmtMs(ms: number) {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
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
  const spotifyState   = useAppStore((s) => s.spotifyState)
  const spotifyControl = useAppStore((s) => s.spotifyControl)

  const activeId   = spotifyState?.activePlaylistId
  const activeName = spotifyState?.activePlaylistName ?? 'No playlist selected'

  const embedRef      = useRef<HTMLDivElement>(null)
  const controllerRef = useRef<EmbedController | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [position, setPosition]   = useState(0)

  // Measure VU container height in pixels — avoids percentage resolution failures
  const vuContainerRef = useRef<HTMLDivElement>(null)
  const [vuMaxPx, setVuMaxPx] = useState(80)
  useEffect(() => {
    const el = vuContainerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height
      if (h && h > 4) setVuMaxPx(h)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (window._spotifyApiLoaded) return
    window._spotifyApiLoaded = true
    const s = document.createElement('script')
    s.src = 'https://open.spotify.com/embed/iframe-api/v1'
    s.async = true
    document.body.appendChild(s)
  }, [])

  useEffect(() => {
    if (!activeId) return
    const uri = `spotify:playlist:${activeId}`
    if (controllerRef.current) { controllerRef.current.loadUri(uri); return }
    if (!embedRef.current) return
    window.onSpotifyIframeApiReady = (IFrameAPI) => {
      if (!embedRef.current) return
      IFrameAPI.createController(embedRef.current, { uri }, (ctrl) => {
        controllerRef.current = ctrl
        ctrl.addListener('playback_update', (e) => {
          setIsPlaying(!e.data.isPaused)
          setPosition(e.data.position)
        })
      })
    }
  }, [activeId])

  useEffect(() => {
    const ctrl = controllerRef.current
    if (!spotifyControl || !ctrl) return
    if (spotifyControl.command === 'play-pause' || spotifyControl.command === 'stop') ctrl.togglePlay()
  }, [spotifyControl])

  useEffect(() => {
    dispatchWidgetSignal({ source: appId, event: isPlaying ? 'music:play' : 'music:pause' })
  }, [appId, isPlaying])

  const control = useCallback((cmd: 'play-pause' | 'next' | 'prev' | 'stop') => {
    const ctrl = controllerRef.current
    if (!ctrl) return
    if (cmd === 'play-pause' || cmd === 'stop') ctrl.togglePlay()
  }, [])

  useEffect(() => {
    return addWidgetSimulationIntentListener((payload) => {
      if (payload.widgetId !== appId) return
      if (payload.kind === 'music:play-pause') control('play-pause')
      if (payload.kind === 'music:next') control('next')
      if (payload.kind === 'music:prev') control('prev')
    })
  }, [appId, control])

  useEffect(() => {
    return addWidgetChainActionListener(({ targetWidgetId, action }) => {
      if (targetWidgetId !== appId) return
      if (action === 'music:play-pause') control('play-pause')
      if (action === 'music:next') control('next')
      if (action === 'music:prev') control('prev')
      if (action === 'music:stop') control('stop')
    })
  }, [appId, control])

  return (
    <>
      <style>{`
        @keyframes music-scroll {
          0%   { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        #music-embed-container iframe {
          display: none !important;
          height: 0 !important;
          width: 0 !important;
        }
      `}</style>
      <DesktopWindow
        id="music"
        title="🎵 MUSIC.exe"
        width={280}
        height={420}
        defaultPosition={{ x: 60, y: 120 }}
        zIndex={zIndex}
        state={windowState}
        windowClassName="desktop-window--music"
        bodyClassName="desktop-window-body--music"
        onFocus={onFocus}
        onMinimize={onMinimize}
        onClose={onClose}
        bodyStyle={{ padding: 0, display: 'flex', flexDirection: 'column' }}
      >
        {/* ── Main display panel — everything except the embed ── */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          overflow: 'hidden',
          margin: '8px 10px 4px',
          background: 'var(--widget-display-bg, rgba(0,0,0,0.4))',
          border: '1px solid var(--widget-display-border, rgba(0,255,136,0.15))',
          borderRadius: 6,
          padding: '8px 10px',
        }}>
          {/* Status + elapsed in one row */}
          <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: "'VT323', monospace", fontSize: 13, letterSpacing: '0.12em', color: 'rgba(195,223,255,0.72)' }}>
              {isPlaying ? 'NOW PLAYING' : activeId ? 'PAUSED' : 'SPOTIFY'}
            </span>
            <span style={{ fontFamily: "'VT323', monospace", fontSize: 13, letterSpacing: '0.1em', color: 'rgba(0,255,136,0.6)' }}>
              {fmtMs(position)}
            </span>
          </div>

          {/* Scrolling name */}
          <div style={{ flexShrink: 0, overflow: 'hidden', width: '100%', height: 18 }}>
            <span style={{
              display: 'inline-block',
              whiteSpace: 'nowrap',
              fontSize: 12,
              color: 'var(--widget-input-text, #c8ffe0)',
              animation: 'music-scroll 10s linear infinite',
            }}>
              {activeName}
            </span>
          </div>

          {/* Transport */}
          <div className="widget-toolbar widget-toolbar--music" style={{ flexShrink: 0, height: 25 }}>
            <button type="button" data-sim-action="music-prev"  className="widget-toolbar-button" onClick={() => control('prev')}>|◀</button>
            <button type="button" data-sim-action="music-play"  className="widget-toolbar-button" onClick={() => control('play-pause')}
              style={{ color: isPlaying ? '#00ff88' : undefined }}>
              {isPlaying ? '⏸' : '▶'}
            </button>
            <button type="button" className="widget-toolbar-button" onClick={() => control('stop')}>■</button>
            <button type="button" data-sim-action="music-next"  className="widget-toolbar-button" onClick={() => control('next')}>▶|</button>
          </div>

          {/* VU bars wrapper — ensures minimum height */}
          <div style={{ flex: 1, minHeight: 200, overflow: 'hidden' }}>
            <div ref={vuContainerRef} style={{ width: '100%', height: '100%' }}>
              <VUBar maxPx={vuMaxPx} />
            </div>
          </div>
        </div>

        {/* ── Spotify embed wrapper ── */}
        <div style={{
          flex: '0 1 0px',
          minHeight: '0px',
          // overflow: 'hidden',
          margin: '0 10px 8px',
        }}>
          <div id="music-embed-container" ref={embedRef} />
        </div>
      </DesktopWindow>
    </>
  )
}
