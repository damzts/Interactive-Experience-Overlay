import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import type { SceneMachine } from '../state/machine.js'
import { DEFAULT_CONFIG, STATE, withDesktopConfigDefaults, withLobbyConfigDefaults, withOverlayStyleDefaults } from '@ieom/shared'
import type { AppConfig, Application, DesktopConfig } from '@ieom/shared'
import { getConfig as getDbConfig, setConfig as setDbConfig } from '../db/db.js'

const REQUIRED_DESKTOP_APP_IDS = new Set(['recycle-bin', 'sticky-notes', 'chat'])

function withConfigDefaults(next: AppConfig): AppConfig {
  const requiredApps = DEFAULT_CONFIG.applications.filter((app) => REQUIRED_DESKTOP_APP_IDS.has(app.id))
  const applications = [...next.applications]
  const lobbyScene = next.scenes[STATE.LOBBY] ?? DEFAULT_CONFIG.scenes[STATE.LOBBY]
  const desktopScene = next.scenes[STATE.DESKTOP] ?? DEFAULT_CONFIG.scenes[STATE.DESKTOP]
  const defaultLobbyStyle = structuredClone(DEFAULT_CONFIG.scenes[STATE.LOBBY].style ?? DEFAULT_CONFIG.overlayStyle)
  const defaultDesktopStyle = structuredClone(DEFAULT_CONFIG.scenes[STATE.DESKTOP].style ?? DEFAULT_CONFIG.overlayStyle)

  for (const app of requiredApps) {
    if (!applications.some((existing) => existing.id === app.id)) {
      applications.push(structuredClone(app))
    }
  }

  return {
    ...next,
    applications,
    scenes: {
      ...next.scenes,
      [STATE.LOBBY]: {
        ...DEFAULT_CONFIG.scenes[STATE.LOBBY],
        ...lobbyScene,
        style: withOverlayStyleDefaults(lobbyScene.style, defaultLobbyStyle),
        lobbyConfig: withLobbyConfigDefaults(lobbyScene.lobbyConfig),
      },
      [STATE.DESKTOP]: {
        ...DEFAULT_CONFIG.scenes[STATE.DESKTOP],
        ...desktopScene,
        style: withOverlayStyleDefaults(desktopScene.style, defaultDesktopStyle),
      },
    },
    overlayStyle: withOverlayStyleDefaults(next.overlayStyle, structuredClone(DEFAULT_CONFIG.overlayStyle)),
    desktopConfig: withDesktopConfigDefaults(next.desktopConfig),
    events: next.events?.length ? next.events : structuredClone(DEFAULT_CONFIG.events),
    mediaLibrary: next.mediaLibrary ?? [],
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

  app.patch<{ Body: Partial<DesktopConfig> }>(
    '/api/config/desktop',
    async (req, reply) => {
      try {
        const currentDesktop = withDesktopConfigDefaults(config.desktopConfig)
        const nextDesktop = withDesktopConfigDefaults({
          ...currentDesktop,
          ...req.body,
          recycleBin: {
            ...currentDesktop.recycleBin,
            ...req.body.recycleBin,
          },
          stickyNotes: {
            ...currentDesktop.stickyNotes,
            ...req.body.stickyNotes,
          },
          screenSaver: {
            ...currentDesktop.screenSaver,
            ...req.body.screenSaver,
          },
          systemSounds: {
            ...currentDesktop.systemSounds,
            ...req.body.systemSounds,
          },
          widgetPositions: {
            ...currentDesktop.widgetPositions,
            ...req.body.widgetPositions,
          },
        })
        save({ ...config, desktopConfig: nextDesktop })
        return { ok: true }
      } catch (e) {
        return reply.code(400).send({ ok: false, error: String(e) })
      }
    },
  )

  app.patch<{ Params: { appId: string }; Body: Partial<Application> }>(
    '/api/config/applications/:appId',
    async (req, reply) => {
      try {
        if (!config.applications.some((app) => app.id === req.params.appId)) {
          return reply.code(404).send({ ok: false, error: `Unknown application: ${req.params.appId}` })
        }

        const applications = config.applications.map((app) => (
          app.id === req.params.appId
            ? { ...app, ...req.body }
            : app
        ))

        save({ ...config, applications })
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
