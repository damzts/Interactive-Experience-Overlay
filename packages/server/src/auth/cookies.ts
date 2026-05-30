import crypto from 'node:crypto'
import type { FastifyReply } from 'fastify'

export interface CookieOptions {
  httpOnly: boolean
  secure: boolean
  sameSite: 'strict' | 'lax' | 'none'
  path: string
  maxAge: number
}

const isProduction = (): boolean => process.env.NODE_ENV === 'production'

/**
 * Returns environment-aware cookie options for the given cookie type.
 */
export function getCookieOptions(type: 'access' | 'refresh' | 'csrf'): CookieOptions {
  const secure = isProduction()
  const sameSite: 'strict' | 'lax' = isProduction() ? 'strict' : 'lax'

  switch (type) {
    case 'access':
      return {
        httpOnly: true,
        secure,
        sameSite,
        path: '/',
        maxAge: 86400,
      }
    case 'refresh':
      return {
        httpOnly: true,
        secure,
        sameSite,
        path: '/auth/refresh',
        maxAge: 2592000,
      }
    case 'csrf':
      return {
        httpOnly: false,
        secure,
        sameSite,
        path: '/',
        maxAge: 86400,
      }
  }
}

/**
 * Generates a cryptographically random CSRF token (32 bytes, hex-encoded).
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Sets all three authentication cookies on the reply.
 */
export function setAuthCookies(
  reply: FastifyReply,
  accessToken: string,
  refreshToken: string,
  csrfToken: string
): void {
  const accessOpts = getCookieOptions('access')
  const refreshOpts = getCookieOptions('refresh')
  const csrfOpts = getCookieOptions('csrf')

  reply.setCookie('access_token', accessToken, accessOpts)
  reply.setCookie('refresh_token', refreshToken, refreshOpts)
  reply.setCookie('csrf_token', csrfToken, csrfOpts)
}

/**
 * Clears all three authentication cookies by setting them with maxAge=0.
 */
export function clearAuthCookies(reply: FastifyReply): void {
  reply.clearCookie('access_token', { path: '/' })
  reply.clearCookie('refresh_token', { path: '/auth/refresh' })
  reply.clearCookie('csrf_token', { path: '/' })
}
