import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const PROTECTED_PREFIXES = ['/api/config', '/api/assets', '/api/upload', '/api/archive', '/api/pov', '/api/online']

export async function csrfGuard(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (SAFE_METHODS.has(request.method)) return
  const cookieToken = request.cookies?.csrf_token
  const headerToken = request.headers['x-csrf-token'] as string | undefined
  if (!headerToken || !cookieToken || headerToken !== cookieToken) {
    return reply.status(403).send({ error: 'csrf_invalid' })
  }
}

export function registerCsrfGuard(app: FastifyInstance): void {
  app.addHook('onRequest', async (request, reply) => {
    const url = request.url
    const isProtected = PROTECTED_PREFIXES.some((prefix) => url.startsWith(prefix))
    if (!isProtected) return
    if (url.match(/^\/api\/online\/rooms\/[^/]+\/join/)) return
    await csrfGuard(request, reply)
  })
}
