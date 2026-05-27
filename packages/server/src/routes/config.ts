import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import type { SceneMachine } from '../state/machine.js'
import { mergeAppConfig, withDesktopConfigDefaults } from '@ieom/shared'
import type { AppConfig, Application, DesktopConfig } from '@ieom/shared'
import { configService } from '../services/ConfigService.js'

export { getConfig, persistConfig } from '../services/ConfigService.js'

export async function configRoute(
  app: FastifyInstance,
  opts: FastifyPluginOptions & { machine: SceneMachine },
) {
  const save = (next: AppConfig, updates?: Partial<AppConfig>) => {
    configService.persist(next, opts.machine, updates)
  }

  app.get('/api/config', async (_req, _reply) => {
    return configService.get()
  })

  app.put<{ Body: AppConfig }>('/api/config', async (req, reply) => {
    try {
      save(req.body)
      return { ok: true }
    } catch (e) {
      return reply.code(400).send({ ok: false, error: String(e) })
    }
  })

  app.patch<{ Body: Partial<AppConfig> }>('/api/config', async (req, reply) => {
    try {
      const config = configService.get()
      save(mergeAppConfig(config, req.body), req.body)
      return { ok: true }
    } catch (e) {
      return reply.code(400).send({ ok: false, error: String(e) })
    }
  })

  /** PATCH /api/config/audio — update only volume fields without touching the rest of the config */
  app.patch<{ Body: Partial<AppConfig['audio']> }>('/api/config/audio', async (req, reply) => {
    try {
      const config = configService.get()
      const audio = { ...config.audio, ...req.body }
      save({ ...config, audio }, { audio })
      return { ok: true }
    } catch (e) {
      return reply.code(400).send({ ok: false, error: String(e) })
    }
  })

  app.patch<{ Body: Partial<DesktopConfig> }>('/api/config/desktop', async (req, reply) => {
    try {
      const config = configService.get()
      const currentDesktop = withDesktopConfigDefaults(config.desktopConfig)
      const nextDesktop = withDesktopConfigDefaults({
        ...currentDesktop,
        ...req.body,
        recycleBin: { ...currentDesktop.recycleBin, ...req.body.recycleBin },
        screenSaver: { ...currentDesktop.screenSaver, ...req.body.screenSaver },
        systemSounds: { ...currentDesktop.systemSounds, ...req.body.systemSounds },
        widgetPositions: { ...currentDesktop.widgetPositions, ...req.body.widgetPositions },
        widgetSizes: { ...currentDesktop.widgetSizes, ...req.body.widgetSizes },
        widgetDefaultZIndices: { ...currentDesktop.widgetDefaultZIndices, ...req.body.widgetDefaultZIndices },
        widgetZIndices: { ...currentDesktop.widgetZIndices, ...req.body.widgetZIndices },
        widgetLayouts: req.body.widgetLayouts !== undefined ? req.body.widgetLayouts : currentDesktop.widgetLayouts,
      })
      save({ ...config, desktopConfig: nextDesktop }, { desktopConfig: nextDesktop })
      return { ok: true }
    } catch (e) {
      return reply.code(400).send({ ok: false, error: String(e) })
    }
  })

  app.patch<{ Params: { appId: string }; Body: Partial<Application> }>(
    '/api/config/applications/:appId',
    async (req, reply) => {
      try {
        const config = configService.get()
        if (!config.applications.some((app) => app.id === req.params.appId)) {
          return reply.code(404).send({ ok: false, error: `Unknown application: ${req.params.appId}` })
        }
        const applications = config.applications.map((app) =>
          app.id === req.params.appId ? { ...app, ...req.body } : app,
        )
        save({ ...config, applications }, { applications })
        return { ok: true }
      } catch (e) {
        return reply.code(400).send({ ok: false, error: String(e) })
      }
    },
  )

  /** PATCH /api/config/obs — update only OBS credentials without touching the rest of the config */
  app.patch<{ Body: Partial<AppConfig['obs']> }>('/api/config/obs', async (req, reply) => {
    try {
      const config = configService.get()
      const obs = { ...config.obs, ...req.body }
      save({ ...config, obs }, { obs })
      return { ok: true }
    } catch (e) {
      return reply.code(400).send({ ok: false, error: String(e) })
    }
  })
}
