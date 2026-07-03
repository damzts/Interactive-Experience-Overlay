import { io } from 'socket.io-client'
import type { ServerToClientEvents, ClientToServerEvents } from '@ieomlabs/shared'

const overlayPort = typeof window !== 'undefined'
  ? (window.location.port || (window.location.protocol === 'https:' ? '443' : '80'))
  : ''
const overlayKind = overlayPort === '3000'
  ? 'runtime'
  : overlayPort === '3001'
    ? 'dev'
    : 'unknown'
const overlayLabel = overlayKind === 'runtime'
  ? 'OBS Browser Source (3000)'
  : overlayKind === 'dev'
    ? 'Direct Overlay Browser (3001)'
    : `Overlay (${overlayPort || 'unknown'})`

/** Singleton Socket.IO client — created once when this module is first imported */
export const socket = io('/', {
  autoConnect: false,
  auth: {
    clientType: 'overlay',
    overlayKind,
    overlayPort,
    overlayLabel,
  },
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
})

// Prevent Vite HMR from hot-replacing this module. Replacing the socket
// singleton mid-session leaves the new socket unconnected (main.tsx only
// calls socket.connect() once at boot), silently breaking all server events.
// Any change to this file triggers a full page reload instead.
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    import.meta.hot?.invalidate()
  })
}
