import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import type { SceneMachine } from '../state/machine.js'
import { DEFAULT_CONFIG, withDesktopConfigDefaults } from '@ieom/shared'
import type { AppConfig } from '@ieom/shared'
import { getConfig as getDbConfig, setConfig as setDbConfig } from '../db/db.js'

const REQUIRED_DESKTOP_APP_IDS = new Set(['recycle-bin', 'sticky-notes'])

function withConfigDefaults(next: AppConfig): AppConfig {
  const requiredApps = DEFAULT_CONFIG.applications.filter((app) => REQUIRED_DESKTOP_APP_IDS.has(app.id))
  const applications = [...next.applications]

  for (const app of requiredApps) {
    if (!applications.some((existing) => existing.id === app.id)) {
      applications.push(structuredClone(app))
    }
  }

  return {
    ...next,
    applications,
    desktopConfig: withDesktopConfigDefaults(next.desktopConfig),
  }
}

// Load persisted config on startup, fall back to DEFAULT_CONFIG
const persisted = getDbConfig('appConfig') as AppConfig | null
let config: AppConfig = withConfigDefaults(persisted ?? structuredClone(DEFAULT_CONFIG))

export function getConfig() {
  return config
}

export async function configRoute(
  app: FastifyInstance,
  opts: FastifyPluginOptions & { machine: SceneMachine },
) {
  const save = (next: AppConfig) => {
    config = withConfigDefaults(next)
    setDbConfig('appConfig', config)
    opts.machine.emit('config:update', config)
  }

  app.get('/api/config', async (_req, _reply) => {
    return config
  })

  app.put<{ Body: AppConfig }>('/api/config', async (req, reply) => {
    try {
      save(req.body)
      return { ok: true }
    } catch (e) {
      return reply.code(400).send({ ok: false, error: String(e) })
    }
  })

  /** PATCH /api/config/audio — update only volume fields without touching the rest of the config */
  app.patch<{ Body: Partial<AppConfig['audio']> }>(
    '/api/config/audio',
    async (req, reply) => {
      try {
        save({ ...config, audio: { ...config.audio, ...req.body } })
        return { ok: true }
      } catch (e) {
        return reply.code(400).send({ ok: false, error: String(e) })
      }
    },
  )

  /** PATCH /api/config/obs — update only OBS credentials without touching the rest of the config */
  app.patch<{ Body: Partial<AppConfig['obs']> }>(
    '/api/config/obs',
    async (req, reply) => {
      try {
        save({ ...config, obs: { ...config.obs, ...req.body } })
        return { ok: true }
      } catch (e) {
        return reply.code(400).send({ ok: false, error: String(e) })
      }
    },
  )
}
