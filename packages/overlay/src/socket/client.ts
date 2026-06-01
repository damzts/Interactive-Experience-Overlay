import { io } from 'socket.io-client'
import type { ServerToClientEvents, ClientToServerEvents } from '@ieom/shared'

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
