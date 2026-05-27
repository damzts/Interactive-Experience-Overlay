import type { SceneMachine } from '../state/machine.js'
import {
  DEFAULT_CONFIG,
  STATE,
  mergeAppConfig,
  withApplicationListDefaults,
  withDesktopAmbianceDefaults,
  withDesktopConfigDefaults,
  withEventListDefaults,
  withLobbyConfigDefaults,
  withOverlayStyleDefaults,
} from '@ieom/shared'
import type { AppConfig, Application, DesktopConfig } from '@ieom/shared'
import {
  db,
  hasPersistedConfig,
  loadAllConfig,
  saveApplications,
  saveAudioConfig,
  saveDesktopAmbiance,
  saveDesktopConfig,
  saveEvents,
  saveKeybinds,
  saveMediaLibrary,
  saveObsConfig,
  saveOverlayStyle,
  saveScenes,
  saveSourcePresets,
} from '../db/db.js'

const REQUIRED_DESKTOP_APP_IDS = new Set(
  DEFAULT_CONFIG.applications
    .filter((app) => app.id === 'recycle-bin' || (app.appType === 'widget' && app.widgetSource === 'system'))
    .map((app) => app.id),
)

const PERSISTED_CONFIG_KEYS = [
  'scenes',
  'applications',
  'keybinds',
  'obs',
  'audio',
  'overlayStyle',
  'desktopConfig',
  'desktopAmbiance',
  'events',
  'mediaLibrary',
  'sourcePresets',
] as const satisfies ReadonlyArray<keyof AppConfig>

function clone<T>(value: T): T {
  return structuredClone(value)
}

function getSeedAppSource(app: Application) {
  return DEFAULT_CONFIG.applications.find((entry) => entry.id === app.id) ?? app
}

function getSeedSceneSource(sceneId: string, scene: NonNullable<AppConfig['scenes'][string]>) {
  return DEFAULT_CONFIG.scenes[sceneId] ?? scene
}

function buildApplicationDefaultSnapshot(
  app: Application,
  desktopConfig: DesktopConfig,
): NonNullable<Application['defaultConfig']> {
  const source = getSeedAppSource(app)
  const defaultWindowSize = desktopConfig.widgetSizes?.[source.id]
  const defaultZIndex = desktopConfig.widgetDefaultZIndices?.[source.id]
  const themeOverride = source.themeOverride

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
    widgetDefaults:
      source.appType === 'widget'
        ? {
            windowSize: defaultWindowSize ? clone(defaultWindowSize) : undefined,
            defaultZIndex,
            themeOverride: themeOverride ? clone(themeOverride) : undefined,
          }
        : undefined,
  }
}

function buildSceneDefaultSnapshot(
  sceneId: string,
  scene: NonNullable<AppConfig['scenes'][string]>,
): NonNullable<NonNullable<AppConfig['scenes'][string]>['defaultConfig']> {
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

export class ConfigService {
  private config: AppConfig

  constructor() {
    const persisted = hasPersistedConfig() ? loadAllConfig() : null
    this.config = this.withConfigDefaults(persisted ?? structuredClone(DEFAULT_CONFIG))
  }

  get(): AppConfig {
    return this.config
  }

  persist(next: AppConfig, machine?: Pick<SceneMachine, 'emit'>, updates?: Partial<AppConfig>): AppConfig {
    this.config = this.withConfigDefaults(next)

    if (updates) {
      this.writeSections(this.config, Object.keys(updates) as Array<keyof AppConfig>)
    } else {
      this.writeSections(this.config, PERSISTED_CONFIG_KEYS)
    }

    machine?.emit('config:update', this.config)
    if (updates && Object.keys(updates).length > 0) {
      machine?.emit('config:patch', this.buildConfigPatchPayload(this.config, updates), this.config)
    }

    return this.config
  }

  private withConfigDefaults(next: AppConfig): AppConfig {
    const requiredApps = DEFAULT_CONFIG.applications.filter((app) => REQUIRED_DESKTOP_APP_IDS.has(app.id))
    let applications = [...(next.applications ?? [])]
    const lobbyScene = next.scenes[STATE.LOBBY] ?? DEFAULT_CONFIG.scenes[STATE.LOBBY]
    const desktopScene = next.scenes[STATE.DESKTOP] ?? DEFAULT_CONFIG.scenes[STATE.DESKTOP]
    const defaultLobbyStyle = structuredClone(DEFAULT_CONFIG.scenes[STATE.LOBBY].style ?? DEFAULT_CONFIG.overlayStyle)
    const defaultDesktopStyle = structuredClone(DEFAULT_CONFIG.scenes[STATE.DESKTOP].style ?? DEFAULT_CONFIG.overlayStyle)

    for (const app of requiredApps) {
      if (!applications.some((existing) => existing.id === app.id)) {
        applications.push(structuredClone(app))
      }
    }

    applications = withApplicationListDefaults(applications)
    const desktopConfig = withDesktopConfigDefaults(next.desktopConfig)
    applications = applications.map((app) => ({
      ...app,
      defaultConfig: app.defaultConfig
        ? clone(app.defaultConfig)
        : buildApplicationDefaultSnapshot(
            app,
            DEFAULT_CONFIG.desktopConfig ? withDesktopConfigDefaults(DEFAULT_CONFIG.desktopConfig) : desktopConfig,
          ),
    }))

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
      desktopAmbiance: withDesktopAmbianceDefaults(next.desktopAmbiance ?? {}),
      events: withEventListDefaults(next.events?.length ? next.events : structuredClone(DEFAULT_CONFIG.events)),
      mediaLibrary: next.mediaLibrary ?? [],
    }
  }

  private buildConfigPatchPayload(config: AppConfig, updates: Partial<AppConfig>): Partial<AppConfig> {
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

  private writeSections(cfg: AppConfig, keys: ReadonlyArray<keyof AppConfig>) {
    db.transaction(() => {
      for (const key of keys) {
        switch (key) {
          case 'scenes':
            saveScenes(cfg.scenes)
            break
          case 'applications':
            saveApplications(cfg.applications)
            break
          case 'keybinds':
            saveKeybinds(cfg.keybinds)
            break
          case 'obs':
            saveObsConfig(cfg.obs)
            break
          case 'audio':
            saveAudioConfig(cfg.audio)
            break
          case 'overlayStyle':
            saveOverlayStyle(cfg.overlayStyle)
            break
          case 'desktopConfig':
            if (cfg.desktopConfig) saveDesktopConfig(cfg.desktopConfig)
            break
          case 'desktopAmbiance':
            if (cfg.desktopAmbiance) saveDesktopAmbiance(cfg.desktopAmbiance)
            break
          case 'events':
            saveEvents(cfg.events ?? [])
            break
          case 'mediaLibrary':
            saveMediaLibrary(cfg.mediaLibrary ?? [])
            break
          case 'sourcePresets':
            saveSourcePresets(cfg.sourcePresets ?? [])
            break
        }
      }
    })()
  }
}

export const configService = new ConfigService()

/** @deprecated Import configService.get() instead */
export function getConfig() {
  return configService.get()
}

/** @deprecated Import configService.persist() instead */
export function persistConfig(
  next: AppConfig,
  machine?: Pick<SceneMachine, 'emit'>,
  updates?: Partial<AppConfig>,
) {
  return configService.persist(next, machine, updates)
}
