import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import type { AutomationRuleRepository } from '../../db/repositories/AutomationRuleRepository.js'
import type { KernelBus } from '../../kernel/bus.js'
import type { AutomationRule } from '@ieomlabs/shared'
import { randomUUID } from 'crypto'
import '../../kernel/managers/automation.signals.js'

interface AutomationRouteOptions extends FastifyPluginOptions {
  automationRepo: AutomationRuleRepository
  bus: KernelBus
}

export async function automationRoute(app: FastifyInstance, opts: AutomationRouteOptions) {
  const { automationRepo, bus } = opts

  app.get('/api/automation/rules', async () => automationRepo.list())

  app.post<{ Body: Omit<AutomationRule, 'id'> }>('/api/automation/rules', async (req, reply) => {
    const rule: AutomationRule = { id: randomUUID(), ...req.body }
    automationRepo.create(rule)
    bus.emit('automation:rules:changed', { ruleId: rule.id })
    return reply.code(201).send(rule)
  })

  app.patch<{ Params: { id: string }; Body: Partial<Omit<AutomationRule, 'id'>> }>(
    '/api/automation/rules/:id',
    async (req, reply) => {
      const updated = automationRepo.update(req.params.id, req.body)
      if (!updated) return reply.code(404).send({ error: 'Rule not found' })
      bus.emit('automation:rules:changed', { ruleId: req.params.id })
      return updated
    },
  )

  app.delete<{ Params: { id: string } }>('/api/automation/rules/:id', async (req, reply) => {
    const deleted = automationRepo.delete(req.params.id)
    if (!deleted) return reply.code(404).send({ error: 'Rule not found' })
    bus.emit('automation:rules:changed', { ruleId: req.params.id })
    return reply.code(204).send()
  })
}
