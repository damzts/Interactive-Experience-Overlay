import { io, type Socket } from 'socket.io-client'
import { getAuthOrigin, getStoredAuthToken } from '../auth/sessionToken'

/** Singleton socket for admin panel — cookies are sent automatically via withCredentials */
export const socket: Socket = io(getAuthOrigin(), {
  withCredentials: true,
  auth: getStoredAuthToken() ? { token: getStoredAuthToken() as string } : {},
  autoConnect: false,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
})

/**
 * Reconnect the socket (e.g. after a token refresh).
 * Cookies are sent automatically on reconnect — no manual token passing needed.
 */
export function reconnectSocket(): void {
  if (socket.connected) {
    socket.disconnect()
  }
  const token = getStoredAuthToken()
  socket.auth = token ? { token } : {}
  socket.connect()
}
