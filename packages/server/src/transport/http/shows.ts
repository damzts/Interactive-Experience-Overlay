import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import type { ShowSequencer } from '../../kernel/managers/showSequencer.js'
import type { IConfigService } from '../../kernel/managers/config.js'

interface ShowsRouteOptions extends FastifyPluginOptions {
  sequencer: ShowSequencer
  configService: IConfigService
}

export async function showsRoute(app: FastifyInstance, opts: ShowsRouteOptions) {
  const { sequencer, configService } = opts

  /** List all configured shows */
  app.get('/api/shows', async () => {
    return { shows: configService.cachedConfig?.shows ?? [] }
  })

  /** Get running show IDs */
  app.get('/api/shows/running', async () => {
    return { running: sequencer.getRunningShows() }
  })

  /** Start a show by ID */
  app.post<{ Params: { id: string } }>('/api/shows/:id/run', async (req, reply) => {
    const result = sequencer.run(req.params.id)
    return reply.code(result.ok ? 200 : 404).send(result)
  })

  /** Cancel a running show */
  app.post<{ Params: { id: string } }>('/api/shows/:id/cancel', async (req, reply) => {
    sequencer.cancel(req.params.id)
    return reply.send({ ok: true })
  })
}
