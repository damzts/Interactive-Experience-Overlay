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

export function getCookieOptions(type: 'access' | 'refresh' | 'csrf'): CookieOptions {
  const secure = isProduction()
  const sameSite: 'strict' | 'lax' = isProduction() ? 'strict' : 'lax'
  switch (type) {
    case 'access': return { httpOnly: true, secure, sameSite, path: '/', maxAge: 86400 }
    case 'refresh': return { httpOnly: true, secure, sameSite, path: '/auth/refresh', maxAge: 2592000 }
    case 'csrf': return { httpOnly: false, secure, sameSite, path: '/', maxAge: 86400 }
  }
}

export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function setAuthCookies(reply: FastifyReply, accessToken: string, refreshToken: string, csrfToken: string): void {
  reply.setCookie('access_token', accessToken, getCookieOptions('access'))
  reply.setCookie('refresh_token', refreshToken, getCookieOptions('refresh'))
  reply.setCookie('csrf_token', csrfToken, getCookieOptions('csrf'))
}

export function clearAuthCookies(reply: FastifyReply): void {
  reply.clearCookie('access_token', { path: '/' })
  reply.clearCookie('refresh_token', { path: '/auth/refresh' })
  reply.clearCookie('csrf_token', { path: '/' })
}
