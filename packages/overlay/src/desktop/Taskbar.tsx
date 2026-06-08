import { useState, useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
import { STATE } from '@ieomlabs/shared'
import { socket } from '../socket/client'
import { AppGlyph } from './AppGlyph'

interface TaskbarProps {
  startMenuOpen: boolean
  onStartClick: () => void
  onWidgetTaskbarClick: (widgetId: string) => void
}

export function Taskbar({ startMenuOpen, onStartClick, onWidgetTaskbarClick }: TaskbarProps) {
  const [time, setTime] = useState(() => new Date())
  const [volumeOpen, setVolumeOpen] = useState(false)
  const [volume, setVolume] = useState(70)
  const [networkPulse, setNetworkPulse] = useState(false)
  const obsConnected = useAppStore((s) => s.obsConnected)
  const visualState  = useAppStore((s) => s.visualState)
  const config       = useAppStore((s) => s.config)
  const openWidgets = useAppStore((s) => s.openWidgets)
  const minimizedWidgets = useAppStore((s) => s.minimizedWidgets)
  const lastSocketActivityAt = useAppStore((s) => s.lastSocketActivityAt)
  const notificationCount = useAppStore((s) => s.desktopNotifications.length)

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    setVolume(Math.round((config.audio.masterVolume ?? 0.7) * 100))
  }, [config.audio.masterVolume])

  useEffect(() => {
    if (!lastSocketActivityAt) return
    setNetworkPulse(true)
    const id = setTimeout(() => setNetworkPulse(false), 450)
    return () => clearTimeout(id)
  }, [lastSocketActivityAt])

  // Find the active application (if any) by matching targetSceneId to visualState
  const activeApp = visualState !== STATE.DESKTOP && visualState !== STATE.LOBBY
    ? config.applications.find((a) => a.targetSceneId === visualState) ?? null
    : null

  const widgetButtons = config.applications.filter((app) => openWidgets.has(app.id))

  const handleWindowBtnClick = () => {
    // Clicking the active window button returns to DESKTOP
    socket.emit('scene:change', STATE.DESKTOP)
  }

  const handleVolumeChange = (nextVolume: number) => {
    setVolume(nextVolume)
    fetch('/api/config/audio', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ masterVolume: nextVolume / 100 }),
    }).catch(() => {})
  }

  const timeStr = time.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })

  return (
    <div className="taskbar">
      {/* Start button */}
      <button
        className={`taskbar-start-btn${startMenuOpen ? ' taskbar-start-btn--active' : ''}`}
        onClick={onStartClick}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <span className="taskbar-start-icon">⊞</span>
        <span>Start</span>
      </button>

      {/* Separator */}
      <div className="taskbar-separator" />

      {/* Window button for active application */}
      {activeApp && (
        <button
          className="taskbar-window-btn taskbar-window-btn--active"
          onClick={handleWindowBtnClick}
          title={`${activeApp.label} — click to return to desktop`}
        >
          <AppGlyph icon={activeApp.icon} label={activeApp.label} size={16} className="taskbar-window-icon" />
          <span className="taskbar-window-label">{activeApp.label}</span>
        </button>
      )}

      {widgetButtons.map((widget) => {
        const minimized = minimizedWidgets.has(widget.id)
        return (
          <button
            key={widget.id}
            className={`taskbar-window-btn${minimized ? '' : ' taskbar-window-btn--active'}`}
            onClick={() => onWidgetTaskbarClick(widget.id)}
            title={`${widget.label} — ${minimized ? 'restore' : 'minimize'}`}
          >
            <AppGlyph icon={widget.icon} label={widget.label} size={16} className="taskbar-window-icon" />
            <span className="taskbar-window-label">{widget.label}</span>
          </button>
        )
      })}

      {/* Spacer */}
      <div className="taskbar-spacer" />

      {/* System tray */}
      <div className="taskbar-tray">
        <span
          className={`taskbar-tray-icon taskbar-tray-network${networkPulse ? ' taskbar-tray-network--active' : ''}`}
          title={networkPulse ? 'Socket activity' : 'Network idle'}
        >
          NET
        </span>
        <span
          className="taskbar-tray-icon"
          title={obsConnected ? 'OBS connected' : 'OBS disconnected'}
        >
          <span
            style={{
              display: 'inline-block',
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: obsConnected ? '#00cc00' : '#888',
              verticalAlign: 'middle',
              marginRight: 2,
            }}
          />
        </span>
        <span className="taskbar-tray-icon taskbar-tray-badge-wrap" title={`Notifications: ${notificationCount}`}>
          🔔
          {notificationCount > 0 && (
            <span className="taskbar-tray-badge">{notificationCount}</span>
          )}
        </span>
        <button className="taskbar-tray-volume-btn" title="Volume" onClick={() => setVolumeOpen((open) => !open)}>
          🔊
        </button>
        <div className="taskbar-tray-divider" />
        <span className="taskbar-time">
          {timeStr}
        </span>

        {volumeOpen && (
          <div className="taskbar-volume-popup" onMouseDown={(e) => e.stopPropagation()}>
            <div className="taskbar-volume-label">Master Volume</div>
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={(e) => handleVolumeChange(Number(e.target.value))}
              className="taskbar-volume-slider"
            />
            <div className="taskbar-volume-readout">{volume}%</div>
          </div>
        )}
      </div>
    </div>
  )
}
