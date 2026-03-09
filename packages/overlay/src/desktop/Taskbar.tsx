import { useState, useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
import { STATE } from '@ieom/shared'
import { socket } from '../socket/client'

interface TaskbarProps {
  startMenuOpen: boolean
  onStartClick: () => void
}

export function Taskbar({ startMenuOpen, onStartClick }: TaskbarProps) {
  const [time, setTime] = useState(() => new Date())
  const obsConnected = useAppStore((s) => s.obsConnected)
  const visualState  = useAppStore((s) => s.visualState)
  const config       = useAppStore((s) => s.config)

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1_000)
    return () => clearInterval(id)
  }, [])

  // Find the active application (if any) by matching targetSceneId to visualState
  const activeApp = visualState !== STATE.DESKTOP && visualState !== STATE.LOBBY
    ? config.applications.find((a) => a.targetSceneId === visualState) ?? null
    : null

  const handleWindowBtnClick = () => {
    // Clicking the active window button returns to DESKTOP
    socket.emit('scene:change', STATE.DESKTOP)
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
          <span className="taskbar-window-icon">{activeApp.icon}</span>
          <span className="taskbar-window-label">{activeApp.label}</span>
        </button>
      )}

      {/* Spacer */}
      <div className="taskbar-spacer" />

      {/* System tray */}
      <div className="taskbar-tray">
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
        <span className="taskbar-tray-icon" title="Volume">🔊</span>
        <div className="taskbar-tray-divider" />
        <span className="taskbar-time">
          {timeStr}
        </span>
      </div>
    </div>
  )
}
