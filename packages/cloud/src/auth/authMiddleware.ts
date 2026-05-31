import jwt from 'jsonwebtoken'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { verifyAccessToken } from './jwt.js'

declare module 'fastify' {
  interface FastifyRequest {
    userId: string
  }
}

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null
  const cookieToken = request.cookies?.access_token
  const token = bearerToken || cookieToken

  if (!token) return reply.status(401).send({ error: 'unauthorized' })

  try {
    const payload = verifyAccessToken(token)
    request.userId = payload.sub
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) return reply.status(401).send({ error: 'token_expired' })
    return reply.status(401).send({ error: 'unauthorized' })
  }
}

const PROTECTED_PREFIXES = ['/api/config', '/api/assets', '/api/upload', '/api/archive', '/api/pov', '/api/online']

export function registerAuthMiddleware(app: FastifyInstance): void {
  app.addHook('onRequest', async (request, reply) => {
    const url = request.url
    const isProtected = PROTECTED_PREFIXES.some((prefix) => url.startsWith(prefix))
    if (!isProtected) return
    if (url.match(/^\/api\/online\/rooms\/[^/]+\/join/)) return
    await authMiddleware(request, reply)
  })
}
