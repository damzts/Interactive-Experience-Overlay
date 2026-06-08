import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import type { SceneMachine } from '../../kernel/managers/scene.js'
import { mergeAppConfig, withDesktopConfigDefaults } from '@ieomlabs/shared'
import type { AppConfig, Application, Scene } from '@ieomlabs/shared'

interface ConfigServiceLike {
  getForUser(userId: string): Promise<AppConfig>
  persistForUser(userId: string, config: AppConfig, updates?: Partial<AppConfig>): Promise<AppConfig>
  createScene?(app: Application, scene: Scene): AppConfig
}

interface ConfigRouteOptions extends FastifyPluginOptions {
  machine: SceneMachine
  configService: ConfigServiceLike
}

export async function configRoute(app: FastifyInstance, opts: ConfigRouteOptions) {
  const { configService } = opts

  app.get('/api/config', async (req) => configService.getForUser(req.userId))

  app.put<{ Body: AppConfig }>('/api/config', async (req, reply) => {
    try {
      await configService.persistForUser(req.userId, req.body)
      return { ok: true }
    } catch (e) {
      return reply.code(400).send({ ok: false, error: String(e) })
    }
  })

  app.patch<{ Body: Partial<AppConfig> }>('/api/config', async (req, reply) => {
    try {
      const config = await configService.getForUser(req.userId)
      await configService.persistForUser(req.userId, mergeAppConfig(config, req.body), req.body)
      return { ok: true }
    } catch (e) {
      return reply.code(400).send({ ok: false, error: String(e) })
    }
  })

  app.patch<{ Body: Partial<AppConfig['audio']> }>('/api/config/audio', async (req, reply) => {
    try {
      const config = await configService.getForUser(req.userId)
      const audio = { ...config.audio, ...req.body }
      await configService.persistForUser(req.userId, { ...config, audio }, { audio })
      return { ok: true }
    } catch (e) {
      return reply.code(400).send({ ok: false, error: String(e) })
    }
  })

  app.patch<{ Body: Partial<AppConfig['obs']> }>('/api/config/obs', async (req, reply) => {
    try {
      const config = await configService.getForUser(req.userId)
      const obs = { ...config.obs, ...req.body }
      await configService.persistForUser(req.userId, { ...config, obs }, { obs })
      return { ok: true }
    } catch (e) {
      return reply.code(400).send({ ok: false, error: String(e) })
    }
  })

  app.patch<{ Params: { appId: string }; Body: Partial<Application> }>(
    '/api/config/applications/:appId',
    async (req, reply) => {
      try {
        const config = await configService.getForUser(req.userId)
        if (!config.applications.some((a) => a.id === req.params.appId)) {
          return reply.code(404).send({ ok: false, error: `Unknown application: ${req.params.appId}` })
        }
        const applications = config.applications.map((a) =>
          a.id === req.params.appId ? { ...a, ...req.body } : a,
        )
        await configService.persistForUser(req.userId, { ...config, applications }, { applications })
        return { ok: true }
      } catch (e) {
        return reply.code(400).send({ ok: false, error: String(e) })
      }
    },
  )

  /** POST /api/config/scenes — atomically create a scene + linked application (Task 9) */
  app.post<{ Body: { app: Application; scene: Scene } }>('/api/config/scenes', async (req, reply) => {
    try {
      if (!configService.createScene) {
        return reply.code(501).send({ ok: false, error: 'createScene not supported by this config service' })
      }
      const updatedConfig = configService.createScene(req.body.app, req.body.scene)
      return { ok: true, config: updatedConfig }
    } catch (e) {
      return reply.code(400).send({ ok: false, error: String(e) })
    }
  })

}
