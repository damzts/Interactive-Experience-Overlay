import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import type { ReactiveChain } from '@ieomlabs/shared'
import type { ReactiveChainRepository } from '../../db/repositories/ReactiveChainRepository.js'
import { randomUUID } from 'node:crypto'

interface WiresRouteOptions extends FastifyPluginOptions {
  chains: ReactiveChainRepository
}

export async function wiresRoute(app: FastifyInstance, opts: WiresRouteOptions) {
  const { chains } = opts

  app.get('/api/wires', async () => chains.list())

  app.post<{ Body: Omit<ReactiveChain, 'id'> }>('/api/wires', async (req, reply) => {
    const { triggerWidgetId, triggerEvent, targetWidgetId, targetAction, enabled = true } = req.body
    if (!triggerWidgetId || !triggerEvent || !targetWidgetId || !targetAction) {
      return reply.code(400).send({ ok: false, error: 'Missing required fields' })
    }
    const chain = chains.create({ id: randomUUID(), triggerWidgetId, triggerEvent, targetWidgetId, targetAction, enabled })
    return { ok: true, chain }
  })

  app.patch<{ Params: { id: string }; Body: Partial<ReactiveChain> }>('/api/wires/:id', async (req, reply) => {
    const updated = chains.update(req.params.id, req.body)
    if (!updated) return reply.code(404).send({ ok: false, error: 'Not found' })
    return { ok: true, chain: updated }
  })

  app.delete<{ Params: { id: string } }>('/api/wires/:id', async (req, reply) => {
    const deleted = chains.delete(req.params.id)
    if (!deleted) return reply.code(404).send({ ok: false, error: 'Not found' })
    return { ok: true }
  })
}
