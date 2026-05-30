/**
 * Public route resolver plugin.
 * Serves overlay and player pages at /u/:slug/* without authentication.
 * Resolves the slug to a userId via UserRepository and attaches it to the request.
 */

import type { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from 'fastify'
import type { UserRepository } from '../db/repositories/UserRepository.js'

export interface PublicRoutesOptions extends FastifyPluginOptions {
  userRepo: UserRepository
}

/**
 * Fastify plugin for /u/:slug/* routes.
 * Resolves slug → userId, attaches to request, returns 404 if invalid.
 */
export async function publicRoutes(
  app: FastifyInstance,
  opts: PublicRoutesOptions,
): Promise<void> {
  const { userRepo } = opts

  /**
   * preHandler hook that resolves the :slug param to a userId.
   * If the slug is valid, attaches the resolved userId to request.userId.
   * If the slug is invalid, returns 404 { error: "user_not_found" }.
   */
  async function resolveSlug(request: FastifyRequest<{ Params: { slug: string } }>, reply: FastifyReply): Promise<void> {
    const { slug } = request.params
    const user = await userRepo.findBySlug(slug)

    if (!user) {
      return reply.status(404).send({ error: 'user_not_found' })
    }

    // Attach resolved userId to request for downstream handlers
    request.userId = user.id
  }

  // GET /u/:slug/overlay — serve overlay page scoped to the resolved user
  app.get<{ Params: { slug: string } }>(
    '/u/:slug/overlay',
    { preHandler: resolveSlug },
    async (request, reply) => {
      // For now, return a simple HTML page indicating the overlay for this user.
      // The actual static asset serving will be wired in task 10.1.
      return reply
        .type('text/html')
        .send(`<!DOCTYPE html><html><head><title>Overlay</title></head><body><div id="root" data-user-id="${request.userId}"></div></body></html>`)
    },
  )

  // GET /u/:slug/player — serve player page scoped to the resolved user
  app.get<{ Params: { slug: string } }>(
    '/u/:slug/player',
    { preHandler: resolveSlug },
    async (request, reply) => {
      // For now, return a simple HTML page indicating the player for this user.
      // The actual static asset serving will be wired in task 10.1.
      return reply
        .type('text/html')
        .send(`<!DOCTYPE html><html><head><title>Player</title></head><body><div id="root" data-user-id="${request.userId}"></div></body></html>`)
    },
  )
}
