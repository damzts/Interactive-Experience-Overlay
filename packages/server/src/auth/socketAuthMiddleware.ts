import type { Socket } from 'socket.io'
import { verifyAccessToken } from './jwt.js'

/**
 * Parses a raw cookie header string into a key-value map.
 * Uses simple splitting since Socket.IO operates outside Fastify's request lifecycle.
 */
function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {}
  for (const pair of cookieHeader.split('; ')) {
    const eqIdx = pair.indexOf('=')
    if (eqIdx === -1) continue
    const key = pair.slice(0, eqIdx).trim()
    const value = pair.slice(eqIdx + 1).trim()
    cookies[key] = decodeURIComponent(value)
  }
  return cookies
}

/**
 * Socket.IO middleware for the default namespace.
 * Validates the JWT from the `access_token` cookie in the handshake headers
 * and attaches the userId to socket.data.userId on success.
 *
 * Rejects the connection with { message: "authentication_error" } on failure.
 *
 * This middleware is only applied to the default namespace.
 * The /overlay and /online namespaces allow unauthenticated connections
 * and should NOT use this middleware.
 *
 * Requirements: 5.2, 5.3, 5.4
 */
export function socketAuthMiddleware(
  socket: Socket,
  next: (err?: Error) => void
): void {
  const cookieHeader = socket.handshake.headers.cookie
  const cookieToken = cookieHeader ? parseCookies(cookieHeader)['access_token'] : undefined
  const authToken = socket.handshake.auth?.token
  const queryToken = socket.handshake.query?.token
  const token = typeof authToken === 'string' && authToken.trim()
    ? authToken.trim()
    : typeof queryToken === 'string' && queryToken.trim()
      ? queryToken.trim()
      : cookieToken

  if (!token) {
    return next(new Error('authentication_error'))
  }

  try {
    const payload = verifyAccessToken(token)
    socket.data.userId = payload.sub
    next()
  } catch {
    next(new Error('authentication_error'))
  }
}
