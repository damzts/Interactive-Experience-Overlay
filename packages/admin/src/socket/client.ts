import { io, type Socket } from 'socket.io-client'
import { getAuthOrigin, getAdminTokenForAuth, getStoredAuthToken } from '../auth/sessionToken'

/** Singleton socket for admin panel — cookies are sent automatically via withCredentials */
export const socket: Socket = io(getAuthOrigin(), {
  withCredentials: true,
  auth: { clientType: 'admin' },
  autoConnect: false,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
})

/**
 * Reconnect the socket (e.g. after a token refresh).
 * Resolves the admin token from the best available source:
 * - Desktop: via IPC bridge (never in URL)
 * - Web: from URL params or sessionStorage
 */
export async function reconnectSocket(): Promise<void> {
  if (socket.connected) {
    socket.disconnect()
  }

  const adminToken = await getAdminTokenForAuth()
  const authToken = getStoredAuthToken()

  socket.auth = {
    clientType: 'admin',
    ...(adminToken ? { token: adminToken } : {}),
    ...(authToken ? { authToken } : {}),
  }
  socket.connect()
}
