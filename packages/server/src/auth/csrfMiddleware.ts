import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'

/** HTTP methods that are exempt from CSRF validation. */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * Protected route prefixes that require CSRF validation on state-changing methods.
 * Mirrors the same prefixes used by authMiddleware.
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
 * Fastify onRequest hook that validates CSRF tokens on state-changing requests.
 * Exempts GET, HEAD, and OPTIONS methods.
 * Compares the `csrf_token` cookie against the `X-CSRF-Token` header.
 * Returns 403 `{ error: "csrf_invalid" }` on mismatch or missing header.
 */
export async function csrfGuard(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // Safe methods are exempt from CSRF validation
  if (SAFE_METHODS.has(request.method)) {
    return
  }

  const cookieToken = request.cookies?.csrf_token
  const headerToken = request.headers['x-csrf-token'] as string | undefined

  // Reject if the header is missing or either token is absent
  if (!headerToken || !cookieToken) {
    return reply.status(403).send({ error: 'csrf_invalid' })
  }

  // Reject if the tokens do not match
  if (headerToken !== cookieToken) {
    return reply.status(403).send({ error: 'csrf_invalid' })
  }
}

/**
 * Registers the CSRF guard hook on all protected route prefixes.
 * Call this on the Fastify instance after registering the auth middleware.
 */
export function registerCsrfGuard(app: FastifyInstance): void {
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

    await csrfGuard(request, reply)
  })
}
