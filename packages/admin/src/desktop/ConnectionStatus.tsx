import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useDesktopBridge } from './useDesktopBridge'

type StatusState = 'online' | 'offline' | 'error'

/**
 * A small status indicator component for the admin header.
 * Shows connectivity and server health state.
 *
 * - Green dot + "Online": server is running and navigator.onLine is true
 * - Yellow dot + "Offline": navigator.onLine is false
 * - Red dot + "Server Error": server status reports an error
 *
 * Only renders in desktop mode.
 */
export function ConnectionStatus(): ReactNode {
  const bridge = useDesktopBridge()
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Only render in desktop mode
  if (!bridge) {
    return null
  }

  const serverStatus = bridge.server.status

  let state: StatusState = 'online'
  if (!isOnline) {
    state = 'offline'
  } else if (serverStatus?.error) {
    state = 'error'
  }

  const config: Record<StatusState, { dotClass: string; label: string }> = {
    online: {
      dotClass: 'bg-emerald-400',
      label: 'Online',
    },
    offline: {
      dotClass: 'bg-amber-400',
      label: 'Offline',
    },
    error: {
      dotClass: 'bg-red-400',
      label: 'Server Error',
    },
  }

  const { dotClass, label } = config[state]

  return (
    <div className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-zinc-300">
      <span
        className={`inline-block h-2 w-2 rounded-full ${dotClass}`}
        aria-hidden="true"
      />
      <span>{label}</span>
    </div>
  )
}
