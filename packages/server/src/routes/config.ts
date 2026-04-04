import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import type { SceneMachine } from '../state/machine.js'
import { DEFAULT_CONFIG, DEFAULT_RECYCLE_BIN_SETTINGS, DEFAULT_STICKY_NOTES_SETTINGS, STATE, mergeAppConfig, withApplicationListDefaults, withDesktopAmbianceDefaults, withDesktopConfigDefaults, withLobbyConfigDefaults, withOverlayStyleDefaults } from '@ieom/shared'
import type { AppConfig, Application, DesktopConfig } from '@ieom/shared'
import { getConfig as getDbConfig, setConfig as setDbConfig } from '../db/db.js'

function clone<T>(value: T): T {
  return structuredClone(value)
}

function getSeedAppSource(app: Application) {
  return DEFAULT_CONFIG.applications.find((entry) => entry.id === app.id) ?? app
}

function getSeedSceneSource(sceneId: string, scene: NonNullable<AppConfig['scenes'][string]>) {
  return DEFAULT_CONFIG.scenes[sceneId] ?? scene
}

function buildApplicationDefaultSnapshot(app: Application, desktopConfig: DesktopConfig): NonNullable<Application['defaultConfig']> {
  const source = getSeedAppSource(app)
  const defaultWindowSize = desktopConfig.widgetSizes?.[source.id]
  const defaultZIndex = desktopConfig.widgetDefaultZIndices?.[source.id]
  const themeOverride = desktopConfig.widgetThemeOverrides?.[source.id]

  return {
    id: source.id,
    label: source.label,
    icon: source.icon,
    appType: source.appType,
    targetSceneId: source.targetSceneId,
    widgetSource: source.widgetSource,
    widgetComponent: source.widgetComponent,
    transitionType: source.transitionType,
    introTransition: source.introTransition,
    exitTransition: source.exitTransition,
    introTransitions: source.introTransitions ? clone(source.introTransitions) : undefined,
    exitTransitions: source.exitTransitions ? clone(source.exitTransitions) : undefined,
    iconPosition: source.iconPosition ? clone(source.iconPosition) : undefined,
    iconSize: source.iconSize,
    launchPipeline: source.launchPipeline ? clone(source.launchPipeline) : undefined,
    gallerySettings: source.gallerySettings ? clone(source.gallerySettings) : undefined,
    cameraSettings: source.cameraSettings ? clone(source.cameraSettings) : undefined,
    sourceWidgetSettings: source.sourceWidgetSettings ? clone(source.sourceWidgetSettings) : undefined,
    stickyNotesSettings: source.stickyNotesSettings ? clone(source.stickyNotesSettings) : undefined,
    recycleBinSettings: source.recycleBinSettings ? clone(source.recycleBinSettings) : undefined,
    widgetDefaults: source.appType === 'widget'
      ? {
          windowSize: defaultWindowSize ? clone(defaultWindowSize) : undefined,
          defaultZIndex,
          themeOverride: themeOverride ? clone(themeOverride) : undefined,
        }
      : undefined,
  }
}

function buildSceneDefaultSnapshot(sceneId: string, scene: NonNullable<AppConfig['scenes'][string]>): NonNullable<NonNullable<AppConfig['scenes'][string]>['defaultConfig']> {
  const source = getSeedSceneSource(sceneId, scene)
  return {
    label: source.label,
    backgroundOpaque: source.backgroundOpaque,
    sources: clone(source.sources ?? []),
    style: source.style ? clone(source.style) : undefined,
    lobbyConfig: source.lobbyConfig ? clone(source.lobbyConfig) : undefined,
    introTransitions: source.introTransitions ? clone(source.introTransitions) : undefined,
    exitTransitions: source.exitTransitions ? clone(source.exitTransitions) : undefined,
    musicTrack: source.musicTrack,
  }
}

const REQUIRED_DESKTOP_APP_IDS = new Set(
  DEFAULT_CONFIG.applications
    .filter((app) => app.id === 'recycle-bin' || (app.appType === 'widget' && app.widgetSource === 'system'))
    .map((app) => app.id),
)

type LegacyDesktopConfig = Partial<DesktopConfig> & {
  stickyNotes?: Partial<NonNullable<Application['stickyNotesSettings']>> | null
  recycleBin?: Partial<DesktopConfig['recycleBin']> & Partial<NonNullable<Application['recycleBinSettings']>>
}

function migrateLegacyDesktopAppSettings(applications: Application[], desktopConfig?: AppConfig['desktopConfig']) {
  const legacyDesktop = desktopConfig as LegacyDesktopConfig | undefined
  const legacyStickyNotes = legacyDesktop?.stickyNotes ?? undefined
  const legacyRecycleBin = legacyDesktop?.recycleBin ?? undefined

  if (!legacyStickyNotes && !legacyRecycleBin) return applications

  return applications.map((app) => {
    if (app.id === 'sticky-notes' && app.appType === 'widget' && legacyStickyNotes) {
      return {
        ...app,
        stickyNotesSettings: {
          ...DEFAULT_STICKY_NOTES_SETTINGS,
          ...legacyStickyNotes,
          ...app.stickyNotesSettings,
        },
      }
    }

    if (app.id === 'recycle-bin' && app.appType === 'decoration' && legacyRecycleBin) {
      const nextRecycleBinSettings = {
        ...DEFAULT_RECYCLE_BIN_SETTINGS,
        ...(legacyRecycleBin.emptyIcon !== undefined ? { emptyIcon: legacyRecycleBin.emptyIcon } : {}),
        ...(legacyRecycleBin.fullIcon !== undefined ? { fullIcon: legacyRecycleBin.fullIcon } : {}),
        ...app.recycleBinSettings,
      }

      return {
        ...app,
        recycleBinSettings: nextRecycleBinSettings,
      }
    }

    return app
  })
}

function withConfigDefaults(next: AppConfig): AppConfig {
  const requiredApps = DEFAULT_CONFIG.applications.filter((app) => REQUIRED_DESKTOP_APP_IDS.has(app.id))
  let applications = [...(next.applications ?? [])]
  const lobbyScene = next.scenes[STATE.LOBBY] ?? DEFAULT_CONFIG.scenes[STATE.LOBBY]
  const desktopScene = next.scenes[STATE.DESKTOP] ?? DEFAULT_CONFIG.scenes[STATE.DESKTOP]
  const defaultLobbyStyle = structuredClone(DEFAULT_CONFIG.scenes[STATE.LOBBY].style ?? DEFAULT_CONFIG.overlayStyle)
  const defaultDesktopStyle = structuredClone(DEFAULT_CONFIG.scenes[STATE.DESKTOP].style ?? DEFAULT_CONFIG.overlayStyle)

  // Legacy migration: old configs used `browser` widget id. Replace with `gallery`.
  const hasGallery = applications.some((app) => app.id === 'gallery' && app.appType === 'widget')
  if (!hasGallery) {
    applications = applications.map((app) => {
      if (app.id !== 'browser' || app.appType !== 'widget') return app
      return {
        ...app,
        id: 'gallery',
        label: app.label === 'Browser.exe' ? 'GALLERY.exe' : app.label,
        icon: app.icon === '🌐' ? '🖼' : app.icon,
      }
    })
  } else {
    applications = applications.filter((app) => !(app.id === 'browser' && app.appType === 'widget'))
  }

  for (const app of requiredApps) {
    if (!applications.some((existing) => existing.id === app.id)) {
      applications.push(structuredClone(app))
    }
  }

  applications = migrateLegacyDesktopAppSettings(applications, next.desktopConfig)
  applications = withApplicationListDefaults(applications)
  const desktopConfig = withDesktopConfigDefaults(next.desktopConfig)
  applications = applications.map((app) => ({
    ...app,
    defaultConfig: app.defaultConfig ? clone(app.defaultConfig) : buildApplicationDefaultSnapshot(app, DEFAULT_CONFIG.desktopConfig ? withDesktopConfigDefaults(DEFAULT_CONFIG.desktopConfig) : desktopConfig),
  }))

  const migratedAmbiance = structuredClone(next.desktopAmbiance ?? {}) as Partial<NonNullable<AppConfig['desktopAmbiance']>>
  const behaviors = migratedAmbiance.widgetSimulation?.behaviors
  if (behaviors?.browser && !behaviors.gallery) {
    behaviors.gallery = behaviors.browser
  }
  if (behaviors?.browser) {
    delete behaviors.browser
  }

  const scenes: AppConfig['scenes'] = {
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
  }

  for (const [sceneId, scene] of Object.entries(scenes)) {
    scenes[sceneId] = {
      ...scene,
      defaultConfig: scene.defaultConfig ? clone(scene.defaultConfig) : buildSceneDefaultSnapshot(sceneId, scene),
    }
  }

  return {
    ...next,
    applications,
    scenes,
    overlayStyle: withOverlayStyleDefaults(next.overlayStyle, structuredClone(DEFAULT_CONFIG.overlayStyle)),
    desktopConfig,
    desktopAmbiance: withDesktopAmbianceDefaults(migratedAmbiance),
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

function buildConfigPatchPayload(config: AppConfig, updates: Partial<AppConfig>): Partial<AppConfig> {
  const patch: Record<string, unknown> = {}
  const nextDesktopConfig = withDesktopConfigDefaults(config.desktopConfig)

  for (const key of Object.keys(updates) as Array<keyof AppConfig>) {
    if (key === 'desktopConfig' && updates.desktopConfig) {
      const desktopPatch: Record<string, unknown> = {}
      for (const desktopKey of Object.keys(updates.desktopConfig) as Array<keyof NonNullable<AppConfig['desktopConfig']>>) {
        desktopPatch[desktopKey] = nextDesktopConfig[desktopKey]
      }
      patch.desktopConfig = desktopPatch
      continue
    }

    if (key === 'scenes' && updates.scenes) {
      const scenesPatch: Record<string, unknown> = {}
      for (const sceneKey of Object.keys(updates.scenes)) {
        scenesPatch[sceneKey] = config.scenes[sceneKey]
      }
      patch.scenes = scenesPatch
      continue
    }

    patch[key] = config[key]
  }

  return patch as Partial<AppConfig>
}

export function persistConfig(next: AppConfig, machine?: Pick<SceneMachine, 'emit'>, updates?: Partial<AppConfig>) {
  config = withConfigDefaults(next)
  setDbConfig('appConfig', config)
  machine?.emit('config:update', config)
  if (updates && Object.keys(updates).length > 0) {
    machine?.emit('config:patch', buildConfigPatchPayload(config, updates), config)
  }
  return config
}

export async function configRoute(
  app: FastifyInstance,
  opts: FastifyPluginOptions & { machine: SceneMachine },
) {
  const save = (next: AppConfig, updates?: Partial<AppConfig>) => {
    persistConfig(next, opts.machine, updates)
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

  app.patch<{ Body: Partial<AppConfig> }>('/api/config', async (req, reply) => {
    try {
      save(mergeAppConfig(config, req.body), req.body)
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
        save({ ...config, audio: { ...config.audio, ...req.body } }, { audio: { ...config.audio, ...req.body } })
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
          widgetSizes: {
            ...currentDesktop.widgetSizes,
            ...req.body.widgetSizes,
          },
          widgetDefaultZIndices: {
            ...currentDesktop.widgetDefaultZIndices,
            ...req.body.widgetDefaultZIndices,
          },
          widgetZIndices: {
            ...currentDesktop.widgetZIndices,
            ...req.body.widgetZIndices,
          },
          widgetLayouts: req.body.widgetLayouts !== undefined
            ? req.body.widgetLayouts
            : currentDesktop.widgetLayouts,
        })
        save({ ...config, desktopConfig: nextDesktop }, { desktopConfig: nextDesktop })
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

        save({ ...config, applications }, { applications })
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
        save({ ...config, obs: { ...config.obs, ...req.body } }, { obs: { ...config.obs, ...req.body } })
        return { ok: true }
      } catch (e) {
        return reply.code(400).send({ ok: false, error: String(e) })
      }
    },
  )
}
