import * as crypto from 'node:crypto'
import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import { getAuthorizationUrl, getAuthorizationUrlWithState, exchangeCodeForTokens, extractProfile } from './googleOAuth.js'
import { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } from './jwt.js'
import { setAuthCookies, clearAuthCookies, generateCsrfToken } from './cookies.js'
import { authMiddleware } from './authMiddleware.js'
import type { UserRepository } from '../db/repositories/UserRepository.js'

export interface AuthRoutesOptions extends FastifyPluginOptions {
  userRepository: UserRepository
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function normalizeRedirectTarget(value: string | undefined): string {
  if (!value || !value.trim()) return '/admin'
  const trimmed = value.trim()
  if (trimmed === 'desktop' || trimmed === 'electron') return 'ieom://auth'
  if (trimmed === 'web') return '/admin'
  return trimmed
}

function buildRedirectUrl(target: string, params: Record<string, string>): string {
  if (target.startsWith('ieom://')) {
    const url = new URL(target)
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
    return url.toString()
  }
  const url = new URL(target, 'http://localhost:3100')
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  return `${url.pathname}${url.search}${url.hash}`
}

export async function authRoutes(app: FastifyInstance, opts: AuthRoutesOptions): Promise<void> {
  const { userRepository } = opts

  app.get<{ Querystring: { redirect?: string } }>('/auth/google', async (request, reply) => {
    const redirectTarget = normalizeRedirectTarget(request.query.redirect)
    const url = redirectTarget === '/admin' ? getAuthorizationUrl() : getAuthorizationUrlWithState(redirectTarget)
    return reply.redirect(url)
  })

  app.get<{ Querystring: { code?: string; error?: string; state?: string } }>('/auth/google/callback', async (request, reply) => {
    const { code, error, state } = request.query
    const redirectTarget = normalizeRedirectTarget(state)

    if (error || !code) return reply.redirect(buildRedirectUrl(redirectTarget, { error: 'oauth_failed' }))

    try {
      const { idToken } = await exchangeCodeForTokens(code)
      const profile = await extractProfile(idToken)
      const user = await userRepository.upsertFromGoogle(profile)
      const accessToken = signAccessToken(user.id, user.email)
      const refreshToken = signRefreshToken(user.id)
      await userRepository.storeRefreshTokenHash(user.id, hashToken(refreshToken))
      const csrfToken = generateCsrfToken()
      setAuthCookies(reply, accessToken, refreshToken, csrfToken)

      if (redirectTarget.startsWith('ieom://')) return reply.redirect(buildRedirectUrl(redirectTarget, { token: accessToken }))
      return reply.redirect('/admin')
    } catch (err) {
      request.log.error({ err }, 'OAuth callback failed')
      return reply.redirect(buildRedirectUrl(redirectTarget, { error: 'oauth_failed' }))
    }
  })

  app.post('/auth/refresh', async (request, reply) => {
    const refreshToken = request.cookies?.refresh_token
    if (!refreshToken) { clearAuthCookies(reply); return reply.status(401).send({ error: 'refresh_invalid' }) }

    try {
      const { sub: userId } = verifyRefreshToken(refreshToken)
      const storedHash = await userRepository.getRefreshTokenHash(userId)
      if (!storedHash || storedHash !== hashToken(refreshToken)) { clearAuthCookies(reply); return reply.status(401).send({ error: 'refresh_invalid' }) }

      await userRepository.invalidateRefreshToken(userId)
      const user = await userRepository.findById(userId)
      if (!user) { clearAuthCookies(reply); return reply.status(401).send({ error: 'refresh_invalid' }) }

      const newAccessToken = signAccessToken(user.id, user.email)
      const newRefreshToken = signRefreshToken(user.id)
      await userRepository.storeRefreshTokenHash(user.id, hashToken(newRefreshToken))
      setAuthCookies(reply, newAccessToken, newRefreshToken, generateCsrfToken())
      return reply.status(200).send({ success: true })
    } catch {
      clearAuthCookies(reply)
      return reply.status(401).send({ error: 'refresh_invalid' })
    }
  })

  app.post('/auth/logout', async (request, reply) => {
    const token = request.cookies?.access_token
    if (!token) { clearAuthCookies(reply); return reply.status(401).send({ error: 'unauthorized' }) }
    try {
      const payload = verifyAccessToken(token)
      await userRepository.invalidateRefreshToken(payload.sub)
      clearAuthCookies(reply)
      return reply.send({ success: true })
    } catch {
      clearAuthCookies(reply)
      return reply.status(401).send({ error: 'unauthorized' })
    }
  })

  app.get('/auth/me', { preHandler: [authMiddleware] }, async (request, reply) => {
    const user = await userRepository.findById(request.userId)
    if (!user) return reply.status(401).send({ error: 'unauthorized' })
    return reply.send({ id: user.id, email: user.email, name: user.displayName })
  })
}
