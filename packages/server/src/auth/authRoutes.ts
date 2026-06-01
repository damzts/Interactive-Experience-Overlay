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

/**
 * Hashes a refresh token using SHA-256 before storing in the database.
 */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function normalizeRedirectTarget(value: string | undefined): string {
  if (!value || !value.trim()) {
    return '/admin'
  }

  const trimmed = value.trim()
  if (trimmed === 'desktop' || trimmed === 'electron') {
    return 'ieom://auth'
  }
  if (trimmed === 'web') {
    return '/admin'
  }
  return trimmed
}

function buildRedirectUrl(target: string, params: Record<string, string>): string {
  if (target.startsWith('ieom://')) {
    const url = new URL(target)
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value)
    }
    return url.toString()
  }

  const url = new URL(target, 'http://localhost:3000')
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }

  return url.toString()
}

/**
 * Auth routes Fastify plugin.
 * Registers: GET /api/auth/google, GET /api/auth/google/callback, POST /api/auth/refresh, POST /api/auth/logout, GET /api/auth/me
 */
export async function authRoutes(app: FastifyInstance, opts: AuthRoutesOptions): Promise<void> {
  const { userRepository } = opts

  // GET /api/auth/google — redirect to Google authorization URL
  app.get<{ Querystring: { redirect?: string } }>('/api/auth/google', async (request, reply) => {
    const redirectTarget = normalizeRedirectTarget(request.query.redirect)
    const url = redirectTarget === '/admin'
      ? getAuthorizationUrl()
      : getAuthorizationUrlWithState(redirectTarget)
    request.log.info({ url }, 'oauth: authorization URL')
    return reply.redirect(url)
  })

  // GET /api/auth/google/callback — exchange code, upsert user, issue cookies, redirect to admin
  app.get<{ Querystring: { code?: string; error?: string; state?: string } }>(
    '/api/auth/google/callback',
    async (request, reply) => {
      const { code, error, state } = request.query
      const redirectTarget = normalizeRedirectTarget(state)

      // If Google returned an error or no code, redirect to login with error
      if (error || !code) {
        return reply.redirect(buildRedirectUrl(redirectTarget, { error: 'oauth_failed' }))
      }

      try {
        // Exchange authorization code for tokens
        const { idToken } = await exchangeCodeForTokens(code)

        // Extract user profile from ID token
        const profile = await extractProfile(idToken)

        // Upsert user in database
        const user = await userRepository.upsertFromGoogle(profile)

        // Sign JWT access token and refresh token
        const accessToken = signAccessToken(user.id, user.email)
        const refreshToken = signRefreshToken(user.id)

        // Hash and store the refresh token
        const refreshTokenHash = hashToken(refreshToken)
        await userRepository.storeRefreshTokenHash(user.id, refreshTokenHash)

        // Generate CSRF token and set all auth cookies
        const csrfToken = generateCsrfToken()
        setAuthCookies(reply, accessToken, refreshToken, csrfToken)

        // Redirect to the caller's target. Desktop uses ieom://auth?token=...
        if (redirectTarget.startsWith('ieom://')) {
          return reply.redirect(buildRedirectUrl(redirectTarget, { token: accessToken }))
        }

        return reply.redirect(buildRedirectUrl(redirectTarget, { auth: 'success' }))
      } catch (err) {
        request.log.error({ err }, 'OAuth callback failed')
        return reply.redirect(buildRedirectUrl(redirectTarget, { error: 'oauth_failed' }))
      }
    }
  )

  // POST /api/auth/refresh — validate refresh token from cookie, issue new cookies
  app.post(
    '/api/auth/refresh',
    async (request, reply) => {
      const refreshToken = request.cookies?.refresh_token

      if (!refreshToken) {
        clearAuthCookies(reply)
        return reply.status(401).send({ error: 'refresh_invalid' })
      }

      try {
        // Verify the refresh token JWT
        const { sub: userId } = verifyRefreshToken(refreshToken)

        // Compare hash with stored hash
        const storedHash = await userRepository.getRefreshTokenHash(userId)
        const providedHash = hashToken(refreshToken)

        if (!storedHash || storedHash !== providedHash) {
          clearAuthCookies(reply)
          return reply.status(401).send({ error: 'refresh_invalid' })
        }

        // Invalidate the old refresh token
        await userRepository.invalidateRefreshToken(userId)

        // Look up user for email (needed for access token)
        const user = await userRepository.findById(userId)
        if (!user) {
          clearAuthCookies(reply)
          return reply.status(401).send({ error: 'refresh_invalid' })
        }

        // Issue new tokens
        const newAccessToken = signAccessToken(user.id, user.email)
        const newRefreshToken = signRefreshToken(user.id)

        // Store new refresh token hash
        const newRefreshTokenHash = hashToken(newRefreshToken)
        await userRepository.storeRefreshTokenHash(user.id, newRefreshTokenHash)

        // Generate new CSRF token and set all cookies
        const csrfToken = generateCsrfToken()
        setAuthCookies(reply, newAccessToken, newRefreshToken, csrfToken)

        return reply.status(200).send({ success: true })
      } catch (err) {
        // Token verification failed (expired, malformed, wrong secret)
        clearAuthCookies(reply)
        return reply.status(401).send({ error: 'refresh_invalid' })
      }
    }
  )

  // POST /api/auth/logout — invalidate refresh token, clear all cookies
  app.post('/api/auth/logout', async (request, reply) => {
    const token = request.cookies?.access_token

    if (!token) {
      clearAuthCookies(reply)
      return reply.status(401).send({ error: 'unauthorized' })
    }

    try {
      const payload = verifyAccessToken(token)
      await userRepository.invalidateRefreshToken(payload.sub)
      clearAuthCookies(reply)
      return reply.send({ success: true })
    } catch (err) {
      clearAuthCookies(reply)
      return reply.status(401).send({ error: 'unauthorized' })
    }
  })

  // GET /api/auth/me — return authenticated user profile
  app.get(
    '/api/auth/me',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const user = await userRepository.findById(request.userId)

      if (!user) {
        return reply.status(401).send({ error: 'unauthorized' })
      }

      return reply.send({
        id: user.id,
        email: user.email,
        name: user.displayName,
      })
    }
  )
}
