/**
 * Overlay namespace Socket.IO handler — wires the `/overlay` namespace
 * for public overlay clients.
 *
 * This namespace does NOT require authentication. Overlay clients provide
 * a `userId` in the handshake query or auth payload, and are joined to
 * a user-specific room (`user:{userId}`) so that config:update and
 * config:patch events are scoped to the correct user.
 *
 * Requirements: 10.5, 7.4
 */

import type { Server, Namespace, Socket } from 'socket.io'

/**
 * Register the `/overlay` Socket.IO namespace.
 *
 * Overlay clients connect with a `userId` in either:
 * - `socket.handshake.auth.userId`
 * - `socket.handshake.query.userId`
 *
 * On connection, the socket is joined to the room `user:{userId}` so it
 * receives config:update and config:patch events emitted by ConfigService.
 *
 * No authentication middleware is applied — connections are unauthenticated.
 *
 * @param io - The root Socket.IO server instance
 */
export function registerOverlayNamespace(io: Server): Namespace {
  const nsp = io.of('/overlay')

  nsp.on('connection', (socket: Socket) => {
    const userId = resolveUserId(socket)

    if (!userId) {
      // No userId provided — disconnect with an error
      socket.emit('error', { message: 'userId is required' })
      socket.disconnect(true)
      return
    }

    // Store userId on socket data for downstream handlers
    socket.data.userId = userId

    // Join the user-specific room for scoped event delivery
    socket.join(`user:${userId}`)
  })

  return nsp
}

/**
 * Extract the userId from the socket handshake.
 * Checks `auth.userId` first (preferred), then falls back to `query.userId`.
 */
function resolveUserId(socket: Socket): string | null {
  const authUserId = socket.handshake.auth?.userId
  if (typeof authUserId === 'string' && authUserId.trim().length > 0) {
    return authUserId.trim()
  }

  const queryUserId = socket.handshake.query?.userId
  if (typeof queryUserId === 'string' && queryUserId.trim().length > 0) {
    return queryUserId.trim()
  }

  return null
}
