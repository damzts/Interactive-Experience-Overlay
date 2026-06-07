import * as jwt from 'jsonwebtoken'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { verifyAccessToken } from './jwt.js'
import '@fastify/cookie'

declare module 'fastify' {
  interface FastifyRequest {
    userId: string
  }
}

/**
 * Returns the overlay admin token from env, or null.
 * This is a static shared secret that protects the local overlay server
 * against unauthorized access when the port is exposed (Docker misconfig,
 * port forwarding, etc.).
 */
function getAdminToken(): string | null {
  return process.env['OVERLAY_ADMIN_TOKEN']?.trim() || null
}

/**
 * Checks whether the given token matches the configured OVERLAY_ADMIN_TOKEN.
 */
function isValidAdminToken(token: string): boolean {
  const adminToken = getAdminToken()
  if (!adminToken) return false
  return token === adminToken
}

/**
 * Fastify onRequest hook that validates authentication.
 *
 * Priority:
 *   1. Authorization: Bearer <token> header (JWT or overlay admin token)
 *   2. access_token cookie (JWT from OAuth flow)
 *
 * On success, attaches the authenticated user's ID to request.userId.
 * On failure, returns 401 with an appropriate error code.
 */
export async function authMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : null
  const cookieToken = request.cookies?.access_token
  const token = bearerToken || cookieToken

  if (!token) {
    return reply.status(401).send({ error: 'unauthorized' })
  }

  // Try overlay admin token first (shared secret)
  if (isValidAdminToken(token)) {
    request.userId = 'admin'
    return
  }

  // Try JWT verification (for OAuth-authenticated users)
  try {
    const payload = verifyAccessToken(token)
    request.userId = payload.sub
    return
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return reply.status(401).send({ error: 'token_expired' })
    }
    return reply.status(401).send({ error: 'unauthorized' })
  }
}

const PROTECTED_PREFIXES = [
  '/api/config',
  '/api/assets',
  '/api/upload',
  '/api/archive',
  '/api/pov',
  '/api/online',
]

/**
 * Registers the auth middleware on all protected route prefixes.
 * Call this on the Fastify instance before registering route handlers.
 */
export function registerAuthMiddleware(app: FastifyInstance): void {
  app.addHook('onRequest', async (request, reply) => {
    const url = request.url
    const isProtected = PROTECTED_PREFIXES.some((prefix) => url.startsWith(prefix))
    if (!isProtected) return

    if (url.match(/^\/api\/online\/rooms\/[^/]+\/join/)) {
      return
    }

    await authMiddleware(request, reply)
  })
}
