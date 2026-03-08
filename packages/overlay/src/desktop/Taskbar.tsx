import { useState, useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'

export function Taskbar() {
  const [time, setTime] = useState(() => new Date())
  const obsConnected = useAppStore((s) => s.obsConnected)
  const visualState = useAppStore((s) => s.visualState)

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 15_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="taskbar">
      <button className="taskbar-start-btn">
        <span>⊞</span> Start
      </button>

      <div
        className="taskbar-state-indicator"
        title={`Scene: ${visualState}`}
        style={{ marginLeft: 8 }}
      >
        {visualState}
      </div>

      <div className="taskbar-tray">
        <span
          style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: obsConnected ? '#00cc00' : '#888',
            marginRight: 4,
          }}
          title={obsConnected ? 'OBS connected' : 'OBS disconnected'}
        />
        <span className="taskbar-time">
          {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  )
}
