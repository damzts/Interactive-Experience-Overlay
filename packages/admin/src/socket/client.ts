import { io } from 'socket.io-client'

/** Singleton socket for admin panel */
export const socket = io('/', {
  autoConnect: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
})
