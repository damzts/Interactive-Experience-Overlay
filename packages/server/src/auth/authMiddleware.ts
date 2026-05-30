import jwt from 'jsonwebtoken'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { verifyAccessToken } from './jwt.js'

// Extend Fastify request to include userId
declare module 'fastify' {
  interface FastifyRequest {
    userId: string
  }
}

/**
 * Fastify onRequest hook that validates JWT from the access_token cookie.
 * On success, attaches the authenticated user's ID to request.userId.
 * On failure, returns 401 with an appropriate error code.
 *
 * The Authorization header is ignored entirely — authentication is
 * exclusively cookie-based.
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const authHeader = request.headers.authorization
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : null
  const cookieToken = request.cookies?.access_token
  const token = bearerToken || cookieToken

  if (!token) {
    return reply.status(401).send({ error: 'unauthorized' })
  }

  try {
    const payload = verifyAccessToken(token)
    request.userId = payload.sub
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return reply.status(401).send({ error: 'token_expired' })
    }
    return reply.status(401).send({ error: 'unauthorized' })
  }
}

/**
 * Protected route prefixes that require authentication.
 * All routes under these prefixes will have the auth middleware applied.
 */
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

    // Check if the request URL matches any protected prefix
    const isProtected = PROTECTED_PREFIXES.some((prefix) => url.startsWith(prefix))

    if (!isProtected) {
      return
    }

    // Allow unauthenticated access to online room-joining endpoints
    // Room joining is POST /api/online/rooms/:roomId/join
    if (url.match(/^\/api\/online\/rooms\/[^/]+\/join/)) {
      return
    }

    await authMiddleware(request, reply)
  })
}
