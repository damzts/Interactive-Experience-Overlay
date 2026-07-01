import { useState, useEffect } from 'react'
import type { RendererProps } from '../registry'

interface SpotifyState {
  track?: string
  artist?: string
  isPlaying?: boolean
}

/** NOW-PLAYING — shows current Spotify track from runtime config signal. */
export function NowPlayingRenderer({ config, onSignal }: RendererProps) {
  const showArtist = config.showArtist !== false
  const textColor  = String(config.textColor ?? '#ffffff')
  const accent     = String(config.accent    ?? '#1db954')
  const layout     = String(config.layout    ?? 'compact')
  const fontSize   = Number(config.fontSize  ?? 18)
  const position   = String(config.position  ?? 'bottom-left')

  const [track, setTrack]    = useState<SpotifyState>({})
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    return onSignal('config:update', (data: unknown) => {
      const cfg = data as Record<string, unknown> | null
      const spotify = cfg?.spotify as Record<string, unknown> | undefined
      if (!spotify) return
      const t = spotify.currentTrack as SpotifyState | undefined
      if (t?.track) { setTrack(t); setVisible(true) }
      else setVisible(false)
    })
  }, [onSignal])

  if (!visible || !track.track) return null

  const posStyle: React.CSSProperties = {
    top:    position.includes('top')    ? 20 : undefined,
    bottom: position.includes('bottom') ? 20 : undefined,
    left:   position.includes('left')   ? 24 : undefined,
    right:  position.includes('right')  ? 24 : undefined,
  }

  if (layout === 'full') {
    return (
      <div style={{
        position: 'absolute', ...posStyle,
        background: 'rgba(0,0,0,0.75)',
        border: `1px solid ${accent}44`,
        padding: '10px 16px',
        fontFamily: 'VT323, monospace',
        pointerEvents: 'none',
        maxWidth: 320,
      }}>
        <div style={{ fontSize: 13, color: accent, letterSpacing: 2, marginBottom: 4, textTransform: 'uppercase' }}>♪ Now Playing</div>
        <div style={{ fontSize, color: textColor, letterSpacing: 1 }}>{track.track}</div>
        {showArtist && track.artist && (
          <div style={{ fontSize: fontSize * 0.8, color: '#aaa', marginTop: 2 }}>{track.artist}</div>
        )}
      </div>
    )
  }

  return (
    <div style={{
      position: 'absolute', ...posStyle,
      fontFamily: 'VT323, monospace',
      fontSize,
      pointerEvents: 'none',
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <span style={{ color: accent }}>♪</span>
      <span style={{ color: textColor }}>{track.track}</span>
      {showArtist && track.artist && <span style={{ color: '#888' }}>— {track.artist}</span>}
    </div>
  )
}
