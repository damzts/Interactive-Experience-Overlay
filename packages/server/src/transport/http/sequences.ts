import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import type { SequenceStep } from '@ieomlabs/shared'
import type { DesktopConfigService } from '../../kernel/managers/config.js'

interface SequencesRouteOptions extends FastifyPluginOptions {
  configService: DesktopConfigService
}

export async function sequencesRoute(app: FastifyInstance, opts: SequencesRouteOptions) {
  const { configService } = opts

  /** List all saved sequences */
  app.get('/api/sequences', async () => {
    return { sequences: configService.listSequences() }
  })

  /** Create a new sequence */
  app.post<{ Body: { label: string; steps?: SequenceStep[] } }>('/api/sequences', async (req, reply) => {
    const { label, steps } = req.body
    if (!label) {
      return reply.code(400).send({ ok: false, error: 'label is required' })
    }
    const sequence = configService.createSequence(label, steps ?? [])
    return reply.send({ ok: true, sequence })
  })

  /** Update a sequence's label and/or steps */
  app.put<{ Params: { id: string }; Body: { label?: string; steps?: SequenceStep[] } }>('/api/sequences/:id', async (req, reply) => {
    try {
      const sequence = configService.updateSequence(req.params.id, req.body)
      return reply.send({ ok: true, sequence })
    } catch (err) {
      return reply.code(404).send({ ok: false, error: (err as Error).message })
    }
  })

  /** Delete a saved sequence */
  app.delete<{ Params: { id: string } }>('/api/sequences/:id', async (req, reply) => {
    configService.deleteSequence(req.params.id)
    return reply.send({ ok: true })
  })
}
