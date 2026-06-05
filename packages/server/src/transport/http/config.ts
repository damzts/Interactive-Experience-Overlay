import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import type { SceneMachine } from '../../kernel/managers/scene.js'
import { mergeAppConfig, withDesktopConfigDefaults } from '@ieom/shared'
import type { AppConfig, Application, DesktopConfig } from '@ieom/shared'

interface ConfigServiceLike {
  getForUser(userId: string): Promise<AppConfig>
  persistForUser(userId: string, config: AppConfig, machine?: any, updates?: Partial<AppConfig>): Promise<void>
}

interface ConfigRouteOptions extends FastifyPluginOptions {
  machine: SceneMachine
  configService: ConfigServiceLike
}

export async function configRoute(
  app: FastifyInstance,
  opts: ConfigRouteOptions,
) {
  const { configService } = opts

  app.get('/api/config', async (req, _reply) => {
    const userId = req.userId
    return configService.getForUser(userId)
  })

  app.put<{ Body: AppConfig }>('/api/config', async (req, reply) => {
    try {
      const userId = req.userId
      await configService.persistForUser(userId, req.body)
      return { ok: true }
    } catch (e) {
      return reply.code(400).send({ ok: false, error: String(e) })
    }
  })

  app.patch<{ Body: Partial<AppConfig> }>('/api/config', async (req, reply) => {
    try {
      const userId = req.userId
      const config = await configService.getForUser(userId)
      await configService.persistForUser(userId, mergeAppConfig(config, req.body), req.body)
      return { ok: true }
    } catch (e) {
      return reply.code(400).send({ ok: false, error: String(e) })
    }
  })

  /** PATCH /api/config/audio — update only volume fields without touching the rest of the config */
  app.patch<{ Body: Partial<AppConfig['audio']> }>('/api/config/audio', async (req, reply) => {
    try {
      const userId = req.userId
      const config = await configService.getForUser(userId)
      const audio = { ...config.audio, ...req.body }
      await configService.persistForUser(userId, { ...config, audio }, { audio })
      return { ok: true }
    } catch (e) {
      return reply.code(400).send({ ok: false, error: String(e) })
    }
  })

  app.patch<{ Body: Partial<DesktopConfig> }>('/api/config/desktop', async (req, reply) => {
    try {
      const userId = req.userId
      const config = await configService.getForUser(userId)
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
      await configService.persistForUser(userId, { ...config, desktopConfig: nextDesktop }, { desktopConfig: nextDesktop })
      return { ok: true }
    } catch (e) {
      return reply.code(400).send({ ok: false, error: String(e) })
    }
  })

  app.patch<{ Params: { appId: string }; Body: Partial<Application> }>(
    '/api/config/applications/:appId',
    async (req, reply) => {
      try {
        const userId = req.userId
        const config = await configService.getForUser(userId)
        if (!config.applications.some((app) => app.id === req.params.appId)) {
          return reply.code(404).send({ ok: false, error: `Unknown application: ${req.params.appId}` })
        }
        const applications = config.applications.map((app) =>
          app.id === req.params.appId ? { ...app, ...req.body } : app,
        )
        await configService.persistForUser(userId, { ...config, applications }, { applications })
        return { ok: true }
      } catch (e) {
        return reply.code(400).send({ ok: false, error: String(e) })
      }
    },
  )

  /** PATCH /api/config/obs — update only OBS credentials without touching the rest of the config */
  app.patch<{ Body: Partial<AppConfig['obs']> }>('/api/config/obs', async (req, reply) => {
    try {
      const userId = req.userId
      const config = await configService.getForUser(userId)
      const obs = { ...config.obs, ...req.body }
      await configService.persistForUser(userId, { ...config, obs }, { obs })
      return { ok: true }
    } catch (e) {
      return reply.code(400).send({ ok: false, error: String(e) })
    }
  })
}

