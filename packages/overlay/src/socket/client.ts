import { io } from 'socket.io-client'
import type { ServerToClientEvents, ClientToServerEvents } from '@ieom/shared'

/** Singleton Socket.IO client — created once when this module is first imported */
export const socket = io('/', {
  transports: ['websocket', 'polling'],
  autoConnect: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
})
