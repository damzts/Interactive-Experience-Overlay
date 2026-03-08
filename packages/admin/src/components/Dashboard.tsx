import { useEffect, useRef } from 'react'
import { STATE, OVERLAY_EVENT } from '@ieom/shared'
import { socket } from '../socket/client'
import { useAdminStore } from '../store/useAdminStore'

interface DashboardProps {
  currentState: STATE
}

const SCENE_BTNS: { label: string; state: STATE; key: string }[] = [
  { label: 'Lobby (F1)', state: STATE.LOBBY, key: 'LOBBY' },
  { label: 'Gameplay (F2)', state: STATE.GAMEPLAY, key: 'GAMEPLAY' },
  { label: 'TV Mode (F3)', state: STATE.TV, key: 'TV' },
  { label: 'Music (F4)', state: STATE.MUSIC, key: 'MUSIC' },
  { label: 'Archive (F5)', state: STATE.ARCHIVE, key: 'ARCHIVE' },
]

const OVERLAY_BTNS: { label: string; event: OVERLAY_EVENT }[] = [
  { label: '💀 Death', event: OVERLAY_EVENT.DEATH },
  { label: '🏆 Victory', event: OVERLAY_EVENT.VICTORY },
  { label: '❤️ Revive', event: OVERLAY_EVENT.REVIVE },
  { label: '📡 Glitch', event: OVERLAY_EVENT.NETWORK_GLITCH },
]

export function Dashboard({ currentState }: DashboardProps) {
  const obsConnected = useAdminStore((s) => s.obsConnected)
  const lastError = useAdminStore((s) => s.lastError)
  const setLastError = useAdminStore((s) => s.setLastError)

  const changeScene = (target: STATE) => {
    setLastError(null)
    socket.emit('scene:change', target, (err) => {
      if (err) setLastError(err)
    })
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 8 }}>
      {/* Left column — controls */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

        {/* Status Bar */}
        <div className="window">
          <div className="title-bar">
            <div className="title-bar-text">System Status</div>
          </div>
          <div className="window-body" style={{ padding: '8px 12px', fontSize: 12 }}>
            <div>
              Scene:{' '}
              <strong style={{ color: '#000080' }}>{currentState}</strong>
            </div>
            <div style={{ marginTop: 4 }}>
              OBS:{' '}
              <span style={{ color: obsConnected ? 'green' : '#cc0000' }}>
                {obsConnected ? '● Connected' : '○ Disconnected'}
              </span>
            </div>
            {lastError && (
              <div style={{ marginTop: 4, color: '#cc0000', fontSize: 11 }}>
                ⚠ {lastError}
              </div>
            )}
          </div>
        </div>

        {/* Scene Switcher */}
        <div className="window">
          <div className="title-bar">
            <div className="title-bar-text">Scene Switcher</div>
          </div>
          <div className="window-body" style={{ padding: 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {SCENE_BTNS.map(({ label, state }) => (
                <button
                  key={state}
                  onClick={() => changeScene(state)}
                  style={{
                    fontWeight: currentState === state ? 'bold' : 'normal',
                    background: currentState === state ? '#000080' : undefined,
                    color: currentState === state ? '#fff' : undefined,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Overlay Events */}
        <div className="window">
          <div className="title-bar">
            <div className="title-bar-text">Overlay Events</div>
          </div>
          <div className="window-body" style={{ padding: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
              {OVERLAY_BTNS.map(({ label, event }) => (
                <button key={event} onClick={() => socket.emit('overlay:trigger', event)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* PANIC */}
        <button
          onClick={() => socket.emit('panic')}
          style={{
            height: 48,
            background: '#cc0000',
            color: '#fff',
            fontWeight: 'bold',
            fontSize: 16,
            border: '3px outset #ff6666',
            cursor: 'pointer',
            letterSpacing: 2,
          }}
        >
          ⚠ PANIC → LOBBY (Esc)
        </button>

        {/* Keyboard shortcut hint */}
        <div className="window">
          <div className="title-bar">
            <div className="title-bar-text">Keybinds</div>
          </div>
          <div className="window-body" style={{ padding: '6px 10px', fontSize: 11, lineHeight: 1.7 }}>
            <div>F1 Lobby · F2 Gameplay · F3 TV</div>
            <div>F4 Music · F5 Archive · Esc Panic</div>
            <div>D Death · V Victory · R Revive</div>
          </div>
        </div>
      </div>

      {/* Right column — live preview */}
      <div className="window" style={{ height: 'calc(100vh - 16px)' }}>
        <div className="title-bar">
          <div className="title-bar-text">Live Preview — Overlay (1920×1080)</div>
        </div>
        <PreviewPanel />
      </div>
    </div>
  )
}

/** Scales the overlay iframe to fill available space while preserving 16:9 */
function PreviewPanel() {
  const containerRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const container = containerRef.current
    const frame = frameRef.current
    if (!container || !frame) return

    const scale = () => {
      const scaleX = container.clientWidth / 1920
      const scaleY = container.clientHeight / 1080
      const s = Math.min(scaleX, scaleY)
      frame.style.transform = `scale(${s})`
    }

    scale()
    const ro = new ResizeObserver(scale)
    ro.observe(container)
    return () => ro.disconnect()
  }, [])

  return (
    <div
      ref={containerRef}
      className="window-body"
      style={{
        padding: 0,
        overflow: 'hidden',
        height: 'calc(100% - 30px)',
        background: '#111',
        position: 'relative',
      }}
    >
      <iframe
        ref={frameRef}
        src="http://localhost:3001"
        title="Overlay Preview"
        style={{
          width: 1920,
          height: 1080,
          border: 'none',
          transformOrigin: '0 0',
          position: 'absolute',
          top: 0,
          left: 0,
        }}
      />
    </div>
  )
}
