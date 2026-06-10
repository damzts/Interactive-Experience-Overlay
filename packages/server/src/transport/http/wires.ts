import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import type { WidgetWire } from '@ieomlabs/shared'
import type { WidgetWireRepository } from '../../db/repositories/WidgetWireRepository.js'
import type { WidgetIntentManifest } from '@ieomlabs/shared'
import { randomUUID } from 'node:crypto'

interface WiresRouteOptions extends FastifyPluginOptions {
  wires: WidgetWireRepository
  getManifests: () => WidgetIntentManifest[]
  broadcastWires: (wires: WidgetWire[]) => void
}

export async function wiresRoute(app: FastifyInstance, opts: WiresRouteOptions) {
  const { wires, getManifests, broadcastWires } = opts

  const broadcast = () => broadcastWires(wires.list())

  app.get('/api/wires', async () => wires.list())

  app.get('/api/wires/manifests', async () => getManifests())

  app.post<{ Body: Omit<WidgetWire, 'id'> }>('/api/wires', async (req, reply) => {
    const { triggerWidgetId, triggerEvent, targetWidgetId, targetAction, enabled = true, condition } = req.body
    if (!triggerWidgetId || !triggerEvent || !targetWidgetId || !targetAction) {
      return reply.code(400).send({ ok: false, error: 'Missing required fields' })
    }
    const wire = wires.create({ id: randomUUID(), triggerWidgetId, triggerEvent, targetWidgetId, targetAction, enabled, condition })
    broadcast()
    return { ok: true, wire }
  })

  app.patch<{ Params: { id: string }; Body: Partial<WidgetWire> }>('/api/wires/:id', async (req, reply) => {
    const updated = wires.update(req.params.id, req.body)
    if (!updated) return reply.code(404).send({ ok: false, error: 'Not found' })
    broadcast()
    return { ok: true, wire: updated }
  })

  app.delete<{ Params: { id: string } }>('/api/wires/:id', async (req, reply) => {
    const deleted = wires.delete(req.params.id)
    if (!deleted) return reply.code(404).send({ ok: false, error: 'Not found' })
    broadcast()
    return { ok: true }
  })
}
