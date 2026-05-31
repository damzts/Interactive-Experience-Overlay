import type { Socket } from 'socket.io'
import { verifyAccessToken } from './jwt.js'

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {}
  for (const pair of cookieHeader.split('; ')) {
    const eqIdx = pair.indexOf('=')
    if (eqIdx === -1) continue
    cookies[pair.slice(0, eqIdx).trim()] = decodeURIComponent(pair.slice(eqIdx + 1).trim())
  }
  return cookies
}

export function socketAuthMiddleware(socket: Socket, next: (err?: Error) => void): void {
  const cookieHeader = socket.handshake.headers.cookie
  const cookieToken = cookieHeader ? parseCookies(cookieHeader)['access_token'] : undefined
  const authToken = socket.handshake.auth?.token
  const queryToken = socket.handshake.query?.token
  const token = (typeof authToken === 'string' && authToken.trim()) ? authToken.trim()
    : (typeof queryToken === 'string' && queryToken.trim()) ? queryToken.trim()
    : cookieToken

  if (!token) return next(new Error('authentication_error'))

  try {
    const payload = verifyAccessToken(token)
    socket.data.userId = payload.sub
    next()
  } catch {
    next(new Error('authentication_error'))
  }
}
