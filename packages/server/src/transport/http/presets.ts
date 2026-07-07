import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import type { AppConfig } from '@ieomlabs/shared'
import type { DesktopConfigService } from '../../kernel/managers/config.js'

interface PresetsRouteOptions extends FastifyPluginOptions {
  configService: DesktopConfigService
}

export async function presetsRoute(app: FastifyInstance, opts: PresetsRouteOptions) {
  const { configService } = opts

  /** List all saved config presets */
  app.get('/api/presets', async () => {
    return { presets: configService.listPresets() }
  })

  /** Save the current config (or a subset of sections) as a new named preset */
  app.post<{ Body: { label: string; sectionKeys: Array<keyof AppConfig> } }>('/api/presets', async (req, reply) => {
    const { label, sectionKeys } = req.body
    if (!label || !Array.isArray(sectionKeys) || sectionKeys.length === 0) {
      return reply.code(400).send({ ok: false, error: 'label and sectionKeys are required' })
    }
    const preset = configService.savePreset(label, sectionKeys)
    return reply.send({ ok: true, preset })
  })

  /** Apply a saved preset, patching the live config */
  app.post<{ Params: { id: string } }>('/api/presets/:id/apply', async (req, reply) => {
    try {
      const config = await configService.applyPreset(req.params.id)
      return reply.send({ ok: true, config })
    } catch (err) {
      return reply.code(404).send({ ok: false, error: (err as Error).message })
    }
  })

  /** Delete a saved preset */
  app.delete<{ Params: { id: string } }>('/api/presets/:id', async (req, reply) => {
    configService.deletePreset(req.params.id)
    return reply.send({ ok: true })
  })
}
