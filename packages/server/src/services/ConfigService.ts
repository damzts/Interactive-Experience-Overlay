import {
  DEFAULT_CONFIG,
  STATE,
  withApplicationListDefaults,
  withDesktopAmbianceDefaults,
  withDesktopConfigDefaults,
  withEventListDefaults,
  withLobbyConfigDefaults,
  withOverlayStyleDefaults,
} from '@ieom/shared'
import type { AppConfig, Application, DesktopConfig } from '@ieom/shared'
import type { Server as SocketIOServer } from 'socket.io'
import type { TenantRepositories } from '../db/repositories/index.js'
import { withPovConfigDefaults, validatePovConfigBounds } from '../db/repositories/povConfigRepo.js'
import { withOnlineConfigDefaults, validateOnlineConfigBounds } from '../db/repositories/onlineConfigRepo.js'

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
  'povConfig',
  'onlineConfig',
] as const

const DEFAULT_IDLE_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes
const DEFAULT_EVICTION_INTERVAL_MS = 60 * 1000 // check every minute

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


interface CacheEntry {
  config: AppConfig
  lastAccess: number
}

export interface ConfigServiceOptions {
  idleTimeoutMs?: number
  evictionIntervalMs?: number
  io?: SocketIOServer
}

export class ConfigService {
  private cache: Map<string, CacheEntry> = new Map()
  private idleTimeoutMs: number
  private evictionIntervalMs: number
  private evictionTimer: ReturnType<typeof setInterval> | null = null
  private io: SocketIOServer | null

  constructor(
    private repos: TenantRepositories,
    options?: ConfigServiceOptions,
  ) {
    this.idleTimeoutMs = options?.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS
    this.evictionIntervalMs = options?.evictionIntervalMs ?? DEFAULT_EVICTION_INTERVAL_MS
    this.io = options?.io ?? null

    this.evictionTimer = setInterval(() => this.evictIdle(), this.evictionIntervalMs)
    // Allow the process to exit even if the timer is still running
    if (this.evictionTimer.unref) {
      this.evictionTimer.unref()
    }
  }

  /**
   * Load the AppConfig for a user. Returns from cache if available,
   * otherwise loads from all repositories and caches the result.
   */
  async getForUser(userId: string): Promise<AppConfig> {
    const cached = this.cache.get(userId)
    if (cached) {
      cached.lastAccess = Date.now()
      return cached.config
    }

    const config = await this.loadFromDb(userId)
    this.cache.set(userId, { config, lastAccess: Date.now() })
    return config
  }

  /**
   * Persist configuration changes for a user. Updates the cache and emits
   * config:update and config:patch events to the user's Socket.IO room.
   */
  async persistForUser(userId: string, next: AppConfig, updates?: Partial<AppConfig>): Promise<AppConfig> {
    const config = this.withConfigDefaults(next)

    if (updates) {
      await this.writeSections(userId, config, Object.keys(updates) as Array<keyof AppConfig>)
    } else {
      await this.writeSections(userId, config, PERSISTED_CONFIG_KEYS as unknown as Array<keyof AppConfig>)
    }

    this.cache.set(userId, { config, lastAccess: Date.now() })

    // Emit events only to sockets in the user's room
    if (this.io) {
      this.io.to(`user:${userId}`).emit('config:update', config)
      if (updates && Object.keys(updates).length > 0) {
        this.io.to(`user:${userId}`).emit('config:patch', this.buildConfigPatchPayload(config, updates))
      }
    }

    return config
  }

  /**
   * Seed a new user with DEFAULT_CONFIG values across all tenant-scoped tables.
   * Runs within a single transaction — rolls back on any failure.
   */
  async seedNewUser(userId: string): Promise<void> {
    const config = clone(DEFAULT_CONFIG)
    const defaultConfig = this.withConfigDefaults(config)

    // Use a pool client for transaction
    const pool = (this.repos.scene as any).pool as import('pg').Pool
    const client = await pool.connect()

    try {
      await client.query('BEGIN')

      // Scenes
      for (const scene of Object.values(defaultConfig.scenes)) {
        await client.query(
          `INSERT INTO scenes (id, user_id, label, background_opaque, sources_json, style_json, lobby_config_json, transitions_json)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (user_id, id) DO NOTHING`,
          [
            scene.id,
            userId,
            scene.label,
            scene.backgroundOpaque,
            JSON.stringify(scene.sources ?? []),
            scene.style ? JSON.stringify(scene.style) : null,
            scene.lobbyConfig ? JSON.stringify(scene.lobbyConfig) : null,
            JSON.stringify({
              introTransition: scene.introTransition,
              exitTransition: scene.exitTransition,
              introTransitions: scene.introTransitions,
              exitTransitions: scene.exitTransitions,
              musicTrack: scene.musicTrack,
            }),
          ]
        )
      }

      // Applications
      for (const app of defaultConfig.applications) {
        await client.query(
          `INSERT INTO applications (id, user_id, label, icon, app_type, target_scene_id, widget_source, widget_component, icon_position_x, icon_position_y, icon_size, settings_json)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           ON CONFLICT (user_id, id) DO NOTHING`,
          [
            app.id,
            userId,
            app.label,
            app.icon,
            app.appType,
            app.targetSceneId,
            app.widgetSource ?? null,
            app.widgetComponent ?? null,
            app.iconPosition?.x ?? null,
            app.iconPosition?.y ?? null,
            app.iconSize ?? null,
            JSON.stringify({
              transitionType: app.transitionType,
              introTransition: app.introTransition,
              exitTransition: app.exitTransition,
              introTransitions: app.introTransitions,
              exitTransitions: app.exitTransitions,
              launchPipeline: app.launchPipeline,
              gallerySettings: app.gallerySettings,
              cameraSettings: app.cameraSettings,
              sourceWidgetSettings: app.sourceWidgetSettings,
              stickyNotesSettings: app.stickyNotesSettings,
              recycleBinSettings: app.recycleBinSettings,
              themeOverride: app.themeOverride,
            }),
          ]
        )
      }

      // Keybinds
      const keybinds = defaultConfig.keybinds
      for (const [key, action] of Object.entries(keybinds.obs)) {
        await client.query(
          'INSERT INTO keybinds (user_id, scope, key, action) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, scope, key) DO NOTHING',
          [userId, 'obs', key, action]
        )
      }
      for (const [key, action] of Object.entries(keybinds.admin)) {
        await client.query(
          'INSERT INTO keybinds (user_id, scope, key, action) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, scope, key) DO NOTHING',
          [userId, 'admin', key, action]
        )
      }

      // OBS config
      await client.query(
        `INSERT INTO obs_config (user_id, url, password) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO NOTHING`,
        [userId, defaultConfig.obs.url, defaultConfig.obs.password]
      )

      // Audio config
      await client.query(
        `INSERT INTO audio_config (user_id, master_volume, sfx_volume, music_volume) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id) DO NOTHING`,
        [userId, defaultConfig.audio.masterVolume, defaultConfig.audio.sfxVolume, defaultConfig.audio.musicVolume]
      )

      // Overlay style
      const style = defaultConfig.overlayStyle
      await client.query(
        `INSERT INTO overlay_style (user_id, background_json, effects_json, particles_json, font_family, accent_color, text_color)
         VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (user_id) DO NOTHING`,
        [
          userId,
          JSON.stringify(style.background),
          JSON.stringify(style.effects),
          JSON.stringify(style.particles),
          style.fontFamily,
          style.accentColor,
          style.textColor,
        ]
      )

      // Desktop config
      if (defaultConfig.desktopConfig) {
        const dc = defaultConfig.desktopConfig
        await client.query(
          `INSERT INTO desktop_config (user_id, global_theme_json, icon_animation, icon_arrangement, icon_motion, icon_arrangement_motion, default_icon_size, auto_arrange_icons, recycle_bin_json, screen_saver_json, system_sounds_json, widget_positions_json, widget_sizes_json, widget_z_indices_json, widget_default_z_indices_json)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) ON CONFLICT (user_id) DO NOTHING`,
          [
            userId,
            JSON.stringify(dc.globalThemeDefault),
            dc.iconAnimation,
            dc.iconArrangement,
            dc.iconMotion,
            dc.iconArrangementMotion,
            dc.defaultIconSize,
            dc.autoArrangeIcons,
            JSON.stringify(dc.recycleBin),
            JSON.stringify(dc.screenSaver),
            JSON.stringify(dc.systemSounds),
            dc.widgetPositions ? JSON.stringify(dc.widgetPositions) : null,
            dc.widgetSizes ? JSON.stringify(dc.widgetSizes) : null,
            dc.widgetZIndices ? JSON.stringify(dc.widgetZIndices) : null,
            dc.widgetDefaultZIndices ? JSON.stringify(dc.widgetDefaultZIndices) : null,
          ]
        )
      }

      // Desktop ambiance
      if (defaultConfig.desktopAmbiance) {
        await client.query(
          `INSERT INTO desktop_ambiance (user_id, simulation_json) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING`,
          [userId, JSON.stringify(defaultConfig.desktopAmbiance.widgetSimulation)]
        )
      }

      // Events
      for (const event of defaultConfig.events ?? []) {
        await client.query(
          `INSERT INTO events (id, user_id, label, icon, color, desc, effects_json, actions_json, auto_json)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (user_id, id) DO NOTHING`,
          [
            event.id,
            userId,
            event.label,
            event.icon,
            event.color,
            event.desc,
            JSON.stringify(event.effects ?? []),
            event.actions ? JSON.stringify(event.actions) : null,
            JSON.stringify(event.auto),
          ]
        )
      }

      // Source presets
      for (const preset of defaultConfig.sourcePresets ?? []) {
        await client.query(
          `INSERT INTO source_presets (id, user_id, label, plugin_type, config_json, default_position_json)
           VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (user_id, id) DO NOTHING`,
          [
            preset.id,
            userId,
            preset.label,
            preset.pluginType,
            JSON.stringify(preset.config ?? {}),
            preset.defaultPosition ? JSON.stringify(preset.defaultPosition) : null,
          ]
        )
      }

      // POV config
      const povConfig = validatePovConfigBounds(withPovConfigDefaults(defaultConfig.povConfig))
      await client.query(
        `INSERT INTO pov_config (user_id, poll_interval_ms, rolling_window_ms, cooldown_ms, activity_threshold, silence_threshold, health_check_interval_ms, max_connections, transition_type, transition_duration_ms, score_emit_interval_ms, db_floor, db_ceiling)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) ON CONFLICT (user_id) DO NOTHING`,
        [
          userId,
          povConfig.pollIntervalMs,
          povConfig.rollingWindowMs,
          povConfig.cooldownMs,
          povConfig.activityThreshold,
          povConfig.silenceThreshold,
          povConfig.healthCheckIntervalMs,
          povConfig.maxConnections,
          povConfig.transition.type,
          povConfig.transition.durationMs,
          povConfig.scoreEmitIntervalMs,
          povConfig.dbFloor,
          povConfig.dbCeiling,
        ]
      )

      // Online config
      const onlineConfig = validateOnlineConfigBounds(withOnlineConfigDefaults(null))
      await client.query(
        `INSERT INTO online_config (user_id, audio_report_interval_ms, rolling_window_ms, cooldown_ms, activity_threshold, silence_threshold, max_players_per_room, max_active_rooms, score_emit_interval_ms, idle_timeout_ms, transition_type, transition_duration_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) ON CONFLICT (user_id) DO NOTHING`,
        [
          userId,
          onlineConfig.audioReportIntervalMs,
          onlineConfig.rollingWindowMs,
          onlineConfig.cooldownMs,
          onlineConfig.activityThreshold,
          onlineConfig.silenceThreshold,
          onlineConfig.maxPlayersPerRoom,
          onlineConfig.maxActiveRooms,
          onlineConfig.scoreEmitIntervalMs,
          onlineConfig.idleTimeoutMs,
          onlineConfig.transition.type,
          onlineConfig.transition.durationMs,
        ]
      )

      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  }

  /**
   * Remove cache entries that have been idle longer than the configured timeout.
   */
  evictIdle(): void {
    const now = Date.now()
    for (const [userId, entry] of this.cache) {
      if (now - entry.lastAccess > this.idleTimeoutMs) {
        this.cache.delete(userId)
      }
    }
  }

  /**
   * Stop the eviction interval timer. Call this on server shutdown.
   */
  destroy(): void {
    if (this.evictionTimer) {
      clearInterval(this.evictionTimer)
      this.evictionTimer = null
    }
  }

  /**
   * Get the current cache size (for monitoring/testing).
   */
  get cacheSize(): number {
    return this.cache.size
  }

  // ── Private helpers ────────────────────────────────────────────

  private async loadFromDb(userId: string): Promise<AppConfig> {
    const [
      scenes,
      applications,
      keybinds,
      obs,
      audio,
      overlayStyle,
      desktopConfig,
      desktopAmbiance,
      events,
      mediaLibrary,
      sourcePresets,
      povConfig,
      onlineConfig,
    ] = await Promise.all([
      this.repos.scene.findAll(userId),
      this.repos.application.findAll(userId),
      this.repos.keybind.find(userId),
      this.repos.obsConfig.find(userId),
      this.repos.audioConfig.find(userId),
      this.repos.overlayStyle.find(userId),
      this.repos.desktop.find(userId),
      this.repos.ambiance.find(userId),
      this.repos.event.findAll(userId),
      this.repos.media.findAll(userId),
      this.repos.sourcePreset.findAll(userId),
      this.repos.povConfig.getPovConfig(userId),
      this.repos.onlineConfig.getOnlineConfig(userId),
    ])

    const base: AppConfig = {
      scenes,
      applications,
      keybinds,
      obs,
      audio,
      overlayStyle,
      desktopConfig,
      desktopAmbiance,
      events,
      mediaLibrary,
      sourcePresets,
      povConfig,
    }

    return this.withConfigDefaults(base)
  }

  private async writeSections(userId: string, cfg: AppConfig, keys: ReadonlyArray<keyof AppConfig>): Promise<void> {
    const writes: Promise<void>[] = []

    for (const key of keys) {
      switch (key) {
        case 'scenes':
          writes.push(this.repos.scene.saveAll(userId, cfg.scenes))
          break
        case 'applications':
          writes.push(this.repos.application.saveAll(userId, cfg.applications))
          break
        case 'keybinds':
          writes.push(this.repos.keybind.save(userId, cfg.keybinds))
          break
        case 'obs':
          writes.push(this.repos.obsConfig.save(userId, cfg.obs))
          break
        case 'audio':
          writes.push(this.repos.audioConfig.save(userId, cfg.audio))
          break
        case 'overlayStyle':
          writes.push(this.repos.overlayStyle.save(userId, cfg.overlayStyle))
          break
        case 'desktopConfig':
          if (cfg.desktopConfig) writes.push(this.repos.desktop.save(userId, cfg.desktopConfig))
          break
        case 'desktopAmbiance':
          if (cfg.desktopAmbiance) writes.push(this.repos.ambiance.save(userId, cfg.desktopAmbiance))
          break
        case 'events':
          writes.push(this.repos.event.saveAll(userId, cfg.events ?? []))
          break
        case 'mediaLibrary':
          writes.push(this.repos.media.saveAll(userId, cfg.mediaLibrary ?? []))
          break
        case 'sourcePresets':
          writes.push(this.repos.sourcePreset.saveAll(userId, cfg.sourcePresets ?? []))
          break
        case 'povConfig':
          if (cfg.povConfig) writes.push(this.repos.povConfig.upsertPovConfig(userId, cfg.povConfig).then(() => {}))
          break
        case 'onlineConfig' as any:
          // Online config is handled separately via persistOnlineConfig
          break
      }
    }

    await Promise.all(writes)
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
      povConfig: validatePovConfigBounds(withPovConfigDefaults(next.povConfig)),
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
}
