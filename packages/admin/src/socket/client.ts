import { io } from 'socket.io-client'

/** Singleton socket for admin panel */
export const socket = io('/', {
  transports: ['websocket', 'polling'],
  autoConnect: true,
})
