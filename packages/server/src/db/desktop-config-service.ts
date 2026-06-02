/**
 * Desktop-mode ConfigService backed by SQLite (better-sqlite3).
 *
 * Single-tenant: no user_id scoping. All queries operate on a flat schema.
 * Implements the same interface as the multi-tenant ConfigService so it can
 * be used as a drop-in replacement in desktop-entry.ts.
 *
 * Requirements: 3.1, 3.5
 */

import type { DesktopDatabase } from './desktop-db.js'
import type { Server as SocketIOServer } from 'socket.io'
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
import type { AppConfig, Application, DesktopConfig, Scene, OverlayStyle } from '@ieom/shared'
import type { EventConfig, AutoTrigger } from '@ieom/shared'

// ── Types ────────────────────────────────────────────────────────

interface SceneTransitionsPayload {
  introTransition?: string
  exitTransition?: string
  introTransitions?: unknown[]
  exitTransitions?: unknown[]
  musicTrack?: string
}

// ── Helpers ──────────────────────────────────────────────────────

function clone<T>(value: T): T {
  return structuredClone(value)
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function boolToInt(value: boolean | undefined): number {
  return value ? 1 : 0
}


const REQUIRED_DESKTOP_APP_IDS = new Set(
  DEFAULT_CONFIG.applications
    .filter((app) => app.id === 'recycle-bin' || (app.appType === 'widget' && app.widgetSource === 'system'))
    .map((app) => app.id),
)

function getSeedAppSource(app: Application) {
  return DEFAULT_CONFIG.applications.find((entry) => entry.id === app.id) ?? app
}

function getSeedSceneSource(sceneId: string, scene: Scene) {
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
  scene: Scene,
): NonNullable<Scene['defaultConfig']> {
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


// ── DesktopConfigService ─────────────────────────────────────────

/**
 * SQLite-backed ConfigService for desktop mode.
 * No user_id scoping — single-tenant model.
 */
export class DesktopConfigService {
  private cachedConfig: AppConfig | null = null
  private onConfigUpdateListener: ((config: AppConfig) => void) | null = null

  constructor(
    private db: DesktopDatabase,
    private io: SocketIOServer | null = null,
  ) {}

  onConfigUpdate(listener: (config: AppConfig) => void) {
    this.onConfigUpdateListener = listener
  }

  async getForUser(_userId: string): Promise<AppConfig> {
    if (this.cachedConfig) return this.cachedConfig
    const config = this.loadFromDb()
    this.cachedConfig = config
    return config
  }

  async persistForUser(_userId: string, next: AppConfig, updates?: Partial<AppConfig>): Promise<AppConfig> {
    const config = this.withConfigDefaults(next)

    if (updates) {
      this.writeSections(config, Object.keys(updates) as Array<keyof AppConfig>)
    } else {
      this.writeSections(config, [
        'scenes', 'applications', 'keybinds', 'obs', 'audio',
        'overlayStyle', 'desktopConfig', 'desktopAmbiance',
        'events', 'mediaLibrary', 'sourcePresets',
      ])
    }

    this.cachedConfig = config

    if (this.io) {
      this.io.emit('config:update', config)
      if (updates && Object.keys(updates).length > 0) {
        this.io.emit('config:patch', updates)
      }
    }

    this.onConfigUpdateListener?.(config)

    return config
  }

  // ── Private: Load ────────────────────────────────────────────

  private loadFromDb(): AppConfig {
    const scenes = this.loadScenes()
    const applications = this.loadApplications()
    const keybinds = this.loadKeybinds()
    const obs = this.loadObsConfig()
    const audio = this.loadAudioConfig()
    const overlayStyle = this.loadOverlayStyle()
    const desktopConfig = this.loadDesktopConfig()
    const desktopAmbiance = this.loadDesktopAmbiance()
    const events = this.loadEvents()
    const mediaLibrary = this.loadMediaLibrary()
    const sourcePresets = this.loadSourcePresets()

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
    }

    return this.withConfigDefaults(base)
  }

  private loadScenes(): Record<string, Scene> {
    const rows = this.db.prepare('SELECT * FROM scenes').all() as Array<{
      id: string; label: string; background_opaque: number;
      sources_json: string | null; style_json: string | null;
      lobby_config_json: string | null; transitions_json: string | null;
    }>

    const scenes: Record<string, Scene> = {}
    for (const row of rows) {
      const transitions = parseJson<SceneTransitionsPayload>(row.transitions_json, {})
      scenes[row.id] = {
        id: row.id,
        label: row.label,
        backgroundOpaque: row.background_opaque === 1,
        sources: parseJson(row.sources_json, []),
        style: parseJson<OverlayStyle | undefined>(row.style_json, undefined),
        lobbyConfig: parseJson(row.lobby_config_json, undefined),
        introTransition: transitions.introTransition,
        exitTransition: transitions.exitTransition,
        introTransitions: transitions.introTransitions as any,
        exitTransitions: transitions.exitTransitions as any,
        musicTrack: transitions.musicTrack,
      }
    }
    return scenes
  }

  private loadApplications(): Application[] {
    const rows = this.db.prepare('SELECT * FROM applications').all() as Array<{
      id: string; label: string; icon: string; app_type: string;
      target_scene_id: string; widget_source: string | null;
      widget_component: string | null; icon_position_x: number | null;
      icon_position_y: number | null; icon_size: string | null;
      settings_json: string | null;
    }>

    return rows.map((row) => {
      const settings = parseJson<Record<string, unknown>>(row.settings_json, {})
      return {
        id: row.id,
        label: row.label,
        icon: row.icon,
        appType: row.app_type as Application['appType'],
        targetSceneId: row.target_scene_id,
        widgetSource: row.widget_source as Application['widgetSource'] | undefined,
        widgetComponent: row.widget_component as Application['widgetComponent'] | undefined,
        iconPosition: row.icon_position_x != null && row.icon_position_y != null
          ? { x: row.icon_position_x, y: row.icon_position_y }
          : undefined,
        iconSize: row.icon_size as Application['iconSize'] | undefined,
        ...settings,
      } as Application
    })
  }

  private loadKeybinds(): AppConfig['keybinds'] {
    const rows = this.db.prepare('SELECT * FROM keybinds').all() as Array<{
      scope: string; key: string; action: string;
    }>

    const obs: Record<string, string> = {}
    const admin: Record<string, string> = {}
    for (const row of rows) {
      if (row.scope === 'obs') obs[row.key] = row.action
      else if (row.scope === 'admin') admin[row.key] = row.action
    }
    return { obs, admin }
  }

  private loadObsConfig(): AppConfig['obs'] {
    const row = this.db.prepare('SELECT * FROM obs_config WHERE id = 1').get() as {
      url: string; password: string;
    } | undefined
    return row ? { url: row.url, password: row.password } : { url: '', password: '' }
  }

  private loadAudioConfig(): AppConfig['audio'] {
    const row = this.db.prepare('SELECT * FROM audio_config WHERE id = 1').get() as {
      master_volume: number; sfx_volume: number; music_volume: number;
    } | undefined
    return row
      ? { masterVolume: row.master_volume, sfxVolume: row.sfx_volume, musicVolume: row.music_volume }
      : { masterVolume: 1, sfxVolume: 1, musicVolume: 0.7 }
  }

  private loadOverlayStyle(): OverlayStyle {
    const row = this.db.prepare('SELECT * FROM overlay_style WHERE id = 1').get() as {
      background_json: string | null; effects_json: string | null;
      particles_json: string | null; font_family: string | null;
      accent_color: string | null; text_color: string | null;
    } | undefined

    if (!row) return DEFAULT_CONFIG.overlayStyle as OverlayStyle
    return {
      background: parseJson(row.background_json, (DEFAULT_CONFIG.overlayStyle as OverlayStyle).background),
      effects: parseJson(row.effects_json, (DEFAULT_CONFIG.overlayStyle as OverlayStyle).effects),
      particles: parseJson(row.particles_json, (DEFAULT_CONFIG.overlayStyle as OverlayStyle).particles),
      fontFamily: row.font_family ?? (DEFAULT_CONFIG.overlayStyle as OverlayStyle).fontFamily,
      accentColor: row.accent_color ?? (DEFAULT_CONFIG.overlayStyle as OverlayStyle).accentColor,
      textColor: row.text_color ?? (DEFAULT_CONFIG.overlayStyle as OverlayStyle).textColor,
    } as OverlayStyle
  }

  private loadDesktopConfig(): DesktopConfig | undefined {
    const row = this.db.prepare('SELECT * FROM desktop_config WHERE id = 1').get() as {
      global_theme_json: string | null; icon_animation: string | null;
      icon_arrangement: string | null; icon_motion: number | null;
      icon_arrangement_motion: number | null; default_icon_size: string | null;
      auto_arrange_icons: number | null; recycle_bin_json: string | null;
      screen_saver_json: string | null; system_sounds_json: string | null;
      widget_positions_json: string | null; widget_sizes_json: string | null;
      widget_z_indices_json: string | null; widget_default_z_indices_json: string | null;
    } | undefined

    if (!row) return undefined
    return {
      globalThemeDefault: parseJson(row.global_theme_json, undefined),
      iconAnimation: row.icon_animation ?? undefined,
      iconArrangement: row.icon_arrangement ?? undefined,
      iconMotion: row.icon_motion ?? undefined,
      iconArrangementMotion: row.icon_arrangement_motion ?? undefined,
      defaultIconSize: row.default_icon_size ?? undefined,
      autoArrangeIcons: row.auto_arrange_icons != null ? row.auto_arrange_icons === 1 : undefined,
      recycleBin: parseJson(row.recycle_bin_json, undefined),
      screenSaver: parseJson(row.screen_saver_json, undefined),
      systemSounds: parseJson(row.system_sounds_json, undefined),
      widgetPositions: parseJson(row.widget_positions_json, undefined),
      widgetSizes: parseJson(row.widget_sizes_json, undefined),
      widgetZIndices: parseJson(row.widget_z_indices_json, undefined),
      widgetDefaultZIndices: parseJson(row.widget_default_z_indices_json, undefined),
    } as unknown as DesktopConfig
  }

  private loadDesktopAmbiance() {
    const row = this.db.prepare('SELECT * FROM desktop_ambiance WHERE id = 1').get() as {
      simulation_json: string | null;
    } | undefined
    if (!row || !row.simulation_json) return undefined
    return parseJson(row.simulation_json, undefined)
  }

  private loadEvents(): EventConfig[] {
    const rows = this.db.prepare('SELECT * FROM events').all() as Array<{
      id: string; label: string; icon: string; color: string;
      desc: string; effects_json: string; actions_json: string | null;
      auto_json: string;
    }>
    const defaultAuto: AutoTrigger = { enabled: false, mode: 'interval', intervalMin: 0, idleMin: 0, chance: 1, cooldownMin: 0 }
    return rows.map((row) => ({
      id: row.id,
      label: row.label,
      icon: row.icon,
      color: row.color,
      desc: row.desc,
      effects: parseJson(row.effects_json, []),
      actions: parseJson(row.actions_json, undefined),
      auto: parseJson<AutoTrigger>(row.auto_json, defaultAuto),
    }))
  }

  private loadMediaLibrary() {
    const rows = this.db.prepare('SELECT * FROM media_library').all() as Array<{
      id: string; name: string; type: string; url: string; duration: number | null;
    }>
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type as 'image' | 'video',
      url: row.url,
      duration: row.duration ?? undefined,
    }))
  }

  private loadSourcePresets() {
    const rows = this.db.prepare('SELECT * FROM source_presets').all() as Array<{
      id: string; label: string; plugin_type: string;
      config_json: string; default_position_json: string | null;
    }>
    return rows.map((row) => ({
      id: row.id,
      label: row.label,
      pluginType: row.plugin_type,
      config: parseJson(row.config_json, {}),
      defaultPosition: parseJson(row.default_position_json, undefined),
    }))
  }


  // ── Private: Write ───────────────────────────────────────────

  private writeSections(cfg: AppConfig, keys: ReadonlyArray<keyof AppConfig>): void {
    const writeTransaction = this.db.transaction(() => {
      for (const key of keys) {
        switch (key) {
          case 'scenes':
            this.saveScenes(cfg.scenes)
            break
          case 'applications':
            this.saveApplications(cfg.applications)
            break
          case 'keybinds':
            this.saveKeybinds(cfg.keybinds)
            break
          case 'obs':
            this.saveObsConfig(cfg.obs)
            break
          case 'audio':
            this.saveAudioConfig(cfg.audio)
            break
          case 'overlayStyle':
            this.saveOverlayStyle(cfg.overlayStyle)
            break
          case 'desktopConfig':
            if (cfg.desktopConfig) this.saveDesktopConfig(cfg.desktopConfig)
            break
          case 'desktopAmbiance':
            if (cfg.desktopAmbiance) this.saveDesktopAmbiance(cfg.desktopAmbiance)
            break
          case 'events':
            this.saveEvents(cfg.events ?? [])
            break
          case 'mediaLibrary':
            this.saveMediaLibrary(cfg.mediaLibrary ?? [])
            break
          case 'sourcePresets':
            this.saveSourcePresets(cfg.sourcePresets ?? [])
            break
        }
      }
    })
    writeTransaction()
  }

  private saveScenes(scenes: Record<string, Scene>): void {
    this.db.prepare('DELETE FROM scenes').run()
    const insert = this.db.prepare(`
      INSERT INTO scenes (id, label, background_opaque, sources_json, style_json, lobby_config_json, transitions_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    for (const scene of Object.values(scenes)) {
      insert.run(
        scene.id,
        scene.label,
        boolToInt(scene.backgroundOpaque),
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
      )
    }
  }

  private saveApplications(applications: Application[]): void {
    this.db.prepare('DELETE FROM applications').run()
    const insert = this.db.prepare(`
      INSERT INTO applications (id, label, icon, app_type, target_scene_id, widget_source, widget_component, icon_position_x, icon_position_y, icon_size, settings_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const app of applications) {
      const settings: Record<string, unknown> = {}
      if (app.transitionType) settings.transitionType = app.transitionType
      if (app.introTransition) settings.introTransition = app.introTransition
      if (app.exitTransition) settings.exitTransition = app.exitTransition
      if (app.introTransitions) settings.introTransitions = app.introTransitions
      if (app.exitTransitions) settings.exitTransitions = app.exitTransitions
      if (app.launchPipeline) settings.launchPipeline = app.launchPipeline
      if (app.gallerySettings) settings.gallerySettings = app.gallerySettings
      if (app.cameraSettings) settings.cameraSettings = app.cameraSettings
      if (app.sourceWidgetSettings) settings.sourceWidgetSettings = app.sourceWidgetSettings
      if (app.stickyNotesSettings) settings.stickyNotesSettings = app.stickyNotesSettings
      if (app.recycleBinSettings) settings.recycleBinSettings = app.recycleBinSettings
      if (app.themeOverride) settings.themeOverride = app.themeOverride

      insert.run(
        app.id,
        app.label,
        app.icon ?? '',
        app.appType,
        app.targetSceneId ?? '',
        app.widgetSource ?? null,
        app.widgetComponent ?? null,
        app.iconPosition?.x ?? null,
        app.iconPosition?.y ?? null,
        app.iconSize ?? null,
        Object.keys(settings).length > 0 ? JSON.stringify(settings) : null,
      )
    }
  }

  private saveKeybinds(keybinds: AppConfig['keybinds']): void {
    this.db.prepare('DELETE FROM keybinds').run()
    const insert = this.db.prepare('INSERT INTO keybinds (scope, key, action) VALUES (?, ?, ?)')
    for (const [key, action] of Object.entries(keybinds.obs ?? {})) {
      insert.run('obs', key, action)
    }
    for (const [key, action] of Object.entries(keybinds.admin ?? {})) {
      insert.run('admin', key, action)
    }
  }

  private saveObsConfig(obs: AppConfig['obs']): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO obs_config (id, url, password) VALUES (1, ?, ?)
    `).run(obs.url, obs.password)
  }

  private saveAudioConfig(audio: AppConfig['audio']): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO audio_config (id, master_volume, sfx_volume, music_volume) VALUES (1, ?, ?, ?)
    `).run(audio.masterVolume, audio.sfxVolume, audio.musicVolume)
  }

  private saveOverlayStyle(style: OverlayStyle): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO overlay_style (id, background_json, effects_json, particles_json, font_family, accent_color, text_color)
      VALUES (1, ?, ?, ?, ?, ?, ?)
    `).run(
      style.background ? JSON.stringify(style.background) : null,
      style.effects ? JSON.stringify(style.effects) : null,
      style.particles ? JSON.stringify(style.particles) : null,
      style.fontFamily ?? null,
      style.accentColor ?? null,
      style.textColor ?? null,
    )
  }

  private saveDesktopConfig(dc: DesktopConfig): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO desktop_config (id, global_theme_json, icon_animation, icon_arrangement, icon_motion, icon_arrangement_motion, default_icon_size, auto_arrange_icons, recycle_bin_json, screen_saver_json, system_sounds_json, widget_positions_json, widget_sizes_json, widget_z_indices_json, widget_default_z_indices_json)
      VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      dc.globalThemeDefault ? JSON.stringify(dc.globalThemeDefault) : null,
      dc.iconAnimation ?? null,
      dc.iconArrangement ?? null,
      dc.iconMotion ?? null,
      dc.iconArrangementMotion ?? null,
      dc.defaultIconSize ?? null,
      dc.autoArrangeIcons != null ? boolToInt(dc.autoArrangeIcons) : null,
      dc.recycleBin ? JSON.stringify(dc.recycleBin) : null,
      dc.screenSaver ? JSON.stringify(dc.screenSaver) : null,
      dc.systemSounds ? JSON.stringify(dc.systemSounds) : null,
      dc.widgetPositions ? JSON.stringify(dc.widgetPositions) : null,
      dc.widgetSizes ? JSON.stringify(dc.widgetSizes) : null,
      dc.widgetZIndices ? JSON.stringify(dc.widgetZIndices) : null,
      dc.widgetDefaultZIndices ? JSON.stringify(dc.widgetDefaultZIndices) : null,
    )
  }

  private saveDesktopAmbiance(ambiance: NonNullable<AppConfig['desktopAmbiance']>): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO desktop_ambiance (id, simulation_json) VALUES (1, ?)
    `).run(JSON.stringify(ambiance))
  }

  private saveEvents(events: NonNullable<AppConfig['events']>): void {
    this.db.prepare('DELETE FROM events').run()
    const insert = this.db.prepare(`
      INSERT INTO events (id, label, icon, color, "desc", effects_json, actions_json, auto_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const event of events) {
      insert.run(
        event.id,
        event.label,
        event.icon ?? '',
        event.color ?? '',
        event.desc ?? '',
        JSON.stringify(event.effects ?? []),
        event.actions ? JSON.stringify(event.actions) : null,
        JSON.stringify(event.auto ?? { enabled: false, intervalMs: 0 }),
      )
    }
  }

  private saveMediaLibrary(entries: NonNullable<AppConfig['mediaLibrary']>): void {
    this.db.prepare('DELETE FROM media_library').run()
    const insert = this.db.prepare(`
      INSERT INTO media_library (id, name, type, url, duration) VALUES (?, ?, ?, ?, ?)
    `)
    for (const entry of entries) {
      insert.run(entry.id, entry.name, entry.type, entry.url, entry.duration ?? null)
    }
  }

  private saveSourcePresets(presets: NonNullable<AppConfig['sourcePresets']>): void {
    this.db.prepare('DELETE FROM source_presets').run()
    const insert = this.db.prepare(`
      INSERT INTO source_presets (id, label, plugin_type, config_json, default_position_json)
      VALUES (?, ?, ?, ?, ?)
    `)
    for (const preset of presets) {
      insert.run(
        preset.id,
        preset.label,
        preset.pluginType,
        JSON.stringify(preset.config ?? {}),
        preset.defaultPosition ? JSON.stringify(preset.defaultPosition) : null,
      )
    }
  }

  // ── Private: Config Defaults ─────────────────────────────────

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
}
