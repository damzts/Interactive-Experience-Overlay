import { useEffect, useRef } from 'react'
import { useAppStore } from '../store/useAppStore'

export function DesktopNotifications() {
  const notifications = useAppStore((store) => store.desktopNotifications)
  const dismissDesktopNotification = useAppStore((store) => store.dismissDesktopNotification)
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  useEffect(() => {
    for (const item of notifications) {
      if (timers.current.has(item.id)) continue
      const duration = Math.max(1200, item.durationMs ?? 6500)
      const timer = setTimeout(() => {
        dismissDesktopNotification(item.id)
        timers.current.delete(item.id)
      }, duration)
      timers.current.set(item.id, timer)
    }

    const activeIds = new Set(notifications.map((item) => item.id))
    for (const [id, timer] of timers.current.entries()) {
      if (activeIds.has(id)) continue
      clearTimeout(timer)
      timers.current.delete(id)
    }

    return () => {
      for (const timer of timers.current.values()) clearTimeout(timer)
      timers.current.clear()
    }
  }, [dismissDesktopNotification, notifications])

  if (notifications.length === 0) return null

  return (
    <div className="desktop-toast-stack" onMouseDown={(e) => e.stopPropagation()}>
      {notifications.slice().reverse().map((item, index) => (
        <div
          key={item.id}
          className={`desktop-toast${index === notifications.length - 1 ? ' desktop-toast--balloon' : ''}`}
        >
          <div className="desktop-toast-head">
            <div className="desktop-toast-title-wrap">
              <span className="desktop-toast-icon">{item.icon ?? '💬'}</span>
              <span className="desktop-toast-title">{item.title}</span>
            </div>
            <button className="desktop-toast-close" onClick={() => dismissDesktopNotification(item.id)} aria-label="Dismiss notification">
              ×
            </button>
          </div>
          <div className="desktop-toast-body">{item.body}</div>
        </div>
      ))}
    </div>
  )
}