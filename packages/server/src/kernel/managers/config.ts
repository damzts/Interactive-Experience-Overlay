/**
 * Desktop-mode ConfigService backed by SQLite (better-sqlite3).
 *
 * Single-tenant: no user_id scoping. All queries operate on a flat schema.
 * Implements the same interface as the multi-tenant ConfigService so it can
 * be used as a drop-in replacement in desktop-entry.ts.
 */

import type Database from 'better-sqlite3'
import type { Server as SocketIOServer } from 'socket.io'
import {
  DEFAULT_CONFIG,
  DEFAULT_SYSTEM_WIDGET_LAYOUTS,
  STATE,
  withApplicationListDefaults,
  withDesktopAmbianceDefaults,
  withDesktopConfigDefaults,
  withEventListDefaults,
  withLobbyConfigDefaults,
  withOverlayStyleDefaults,
} from '@ieom/shared'
import type {
  AppConfig,
  Application,
  DesktopConfig,
  Manager,
  ManagerStatus,
  Scene,
  WidgetLayoutDefinition,
  WidgetLayoutItem,
  TransitionDefinition,
} from '@ieom/shared'
import type { EventConfig, AutoTrigger } from '@ieom/shared'

type DesktopDatabase = Database.Database

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

function buildApplicationDefaultSnapshot(app: Application): NonNullable<Application['defaultConfig']> {
  const source = getSeedAppSource(app)
  return {
    id: source.id,
    label: source.label,
    icon: source.icon,
    appType: source.appType,
    targetSceneId: source.targetSceneId,
    widgetSource: source.widgetSource,
    widgetComponent: source.widgetComponent,
    transitionType: source.transitionType,
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
          windowSize: source.windowSize ? clone(source.windowSize) : undefined,
          defaultZIndex: source.zIndexDefault,
          themeOverride: source.themeOverride ? clone(source.themeOverride) : undefined,
        }
      : undefined,
  }
}

function buildSceneDefaultSnapshot(sceneId: string, scene: Scene): NonNullable<Scene['defaultConfig']> {
  const source = getSeedSceneSource(sceneId, scene)
  return {
    label: source.label,
    backgroundOpaque: source.backgroundOpaque,
    sources: clone(source.sources ?? []),
    style: source.style ? clone(source.style) : undefined,
    lobbyConfig: source.lobbyConfig ? clone(source.lobbyConfig) : undefined,
    onEntry: source.onEntry ? [...source.onEntry] : undefined,
    onExit: source.onExit ? [...source.onExit] : undefined,
    musicTrack: source.musicTrack,
  }
}

// ── DesktopConfigService ─────────────────────────────────────────

export class DesktopConfigService implements Manager {
  readonly name = 'DesktopConfigService'
  private _status: ManagerStatus = 'idle'
  private _cachedConfig: AppConfig | null = null

  get cachedConfig(): AppConfig | null { return this._cachedConfig }
  private onConfigUpdateListener: ((config: AppConfig) => void) | null = null

  constructor(
    private db: DesktopDatabase,
    private io: SocketIOServer | null = null,
  ) {
    // Ensure required tables exist (guards against incomplete migrations)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS widget_layouts (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        icon TEXT NOT NULL DEFAULT '',
        source TEXT NOT NULL DEFAULT 'user',
        description TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS widget_layout_items (
        layout_id TEXT NOT NULL REFERENCES widget_layouts(id) ON DELETE CASCADE,
        widget_id TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 0,
        x REAL NOT NULL DEFAULT 0,
        y REAL NOT NULL DEFAULT 0,
        width REAL NOT NULL DEFAULT 400,
        height REAL NOT NULL DEFAULT 300,
        focus_priority INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (layout_id, widget_id)
      )
    `)
    this.seedSystemLayouts()
  }

  init(): void { this._status = 'idle' }
  start(): void { this._status = 'running' }
  stop(): void { this._status = 'stopped' }
  dispose(): void { this._status = 'stopped' }
  status(): ManagerStatus { return this._status }

  private seedSystemLayouts(): void {
    const upsertLayout = this.db.prepare(
      'INSERT OR IGNORE INTO widget_layouts (id, label, icon, source, description, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
    )
    const upsertItem = this.db.prepare(
      'INSERT OR IGNORE INTO widget_layout_items (layout_id, widget_id, enabled, x, y, width, height, focus_priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
    this.db.transaction(() => {
      DEFAULT_SYSTEM_WIDGET_LAYOUTS.forEach((layout, i) => {
        upsertLayout.run(layout.id, layout.label, layout.icon, 'system', layout.description ?? null, i)
        for (const item of layout.items) {
          upsertItem.run(layout.id, item.widgetId, item.enabled ? 1 : 0, item.x, item.y, item.width, item.height, item.focusPriority)
        }
      })
    })()
  }

  onConfigUpdate(listener: (config: AppConfig) => void) {
    this.onConfigUpdateListener = listener
  }

  async getForUser(_userId: string): Promise<AppConfig> {
    if (this._cachedConfig) return this._cachedConfig
    const config = this.loadFromDb()
    this._cachedConfig = config
    return config
  }

  async persistForUser(_userId: string, next: AppConfig, updates?: Partial<AppConfig>): Promise<AppConfig> {
    const config = this.withConfigDefaults(next)

    if (updates) {
      this.writeSections(config, Object.keys(updates) as Array<keyof AppConfig>)
    } else {
      this.writeSections(config, [
        'scenes', 'applications', 'keybinds', 'obs', 'audio',
        'desktopConfig', 'desktopAmbiance', 'widgetLayouts',
        'sourceEvents', 'sourceMedia', 'sourcePresets', 'sourceTransitions',
      ])
    }

    this._cachedConfig = config

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
    const base: AppConfig = {
      scenes:           this.loadScenes(),
      applications:     this.loadApplications(),
      keybinds:         this.loadKeybinds(),
      obs:              this.loadObsConfig(),
      audio:            this.loadAudioConfig(),
      desktopConfig:    this.loadDesktopConfig(),
      desktopAmbiance:  this.loadDesktopAmbiance(),
      widgetLayouts:    this.loadWidgetLayouts(),
      sourceEvents:     this.loadSourceEvents(),
      sourceMedia:      this.loadSourceMedia(),
      sourcePresets:    this.loadSourcePresets(),
      sourceTransitions: this.loadSourceTransitions(),
    }
    return this.withConfigDefaults(base)
  }

  private loadScenes(): Record<string, Scene> {
    const rows = this.db.prepare('SELECT * FROM scenes').all() as Array<{
      id: string; label: string; background_opaque: number;
      sources_json: string | null; style_json: string | null;
      lobby_config_json: string | null;
      on_entry_json: string | null; on_exit_json: string | null;
      music_track: string | null;
    }>

    const scenes: Record<string, Scene> = {}
    for (const row of rows) {
      scenes[row.id] = {
        id: row.id,
        label: row.label,
        backgroundOpaque: row.background_opaque === 1,
        sources: parseJson(row.sources_json, []),
        style: parseJson(row.style_json, undefined),
        lobbyConfig: parseJson(row.lobby_config_json, undefined),
        onEntry: parseJson<string[]>(row.on_entry_json, []),
        onExit: parseJson<string[]>(row.on_exit_json, []),
        musicTrack: row.music_track ?? undefined,
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
      window_x: number | null; window_y: number | null;
      window_width: number | null; window_height: number | null;
      z_index_default: number | null; z_index_current: number | null;
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
        windowPosition: row.window_x != null && row.window_y != null
          ? { x: row.window_x, y: row.window_y }
          : undefined,
        windowSize: row.window_width != null || row.window_height != null
          ? { width: row.window_width ?? undefined, height: row.window_height ?? undefined }
          : undefined,
        zIndexDefault: row.z_index_default ?? undefined,
        zIndexCurrent: row.z_index_current ?? undefined,
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

  private loadDesktopConfig(): DesktopConfig | undefined {
    const row = this.db.prepare('SELECT * FROM desktop_config WHERE id = 1').get() as {
      global_theme_json: string | null; icon_animation: string | null;
      icon_arrangement: string | null; icon_motion: number | null;
      icon_arrangement_motion: number | null; default_icon_size: string | null;
      auto_arrange_icons: number | null; recycle_bin_json: string | null;
      screen_saver_json: string | null; system_sounds_json: string | null;
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
    } as unknown as DesktopConfig
  }

  private loadDesktopAmbiance() {
    const row = this.db.prepare('SELECT * FROM desktop_ambiance WHERE id = 1').get() as {
      simulation_json: string | null;
    } | undefined
    if (!row || !row.simulation_json) return undefined
    return parseJson(row.simulation_json, undefined)
  }

  private loadWidgetLayouts(): WidgetLayoutDefinition[] {
    type LayoutRow = { id: string; label: string; icon: string; source: string; description: string | null; sort_order: number }
    type ItemRow = { layout_id: string; widget_id: string; enabled: number; x: number; y: number; width: number; height: number; focus_priority: number }

    const layouts = this.db.prepare('SELECT * FROM widget_layouts ORDER BY sort_order ASC').all() as LayoutRow[]
    const allItems = this.db.prepare('SELECT * FROM widget_layout_items').all() as ItemRow[]

    const itemsByLayout = new Map<string, WidgetLayoutItem[]>()
    for (const item of allItems) {
      const list = itemsByLayout.get(item.layout_id) ?? []
      list.push({ widgetId: item.widget_id, enabled: item.enabled === 1, x: item.x, y: item.y, width: item.width, height: item.height, focusPriority: item.focus_priority })
      itemsByLayout.set(item.layout_id, list)
    }

    return layouts.map((row) => ({
      id: row.id,
      label: row.label,
      icon: row.icon,
      source: row.source as 'system' | 'user',
      description: row.description ?? undefined,
      items: itemsByLayout.get(row.id) ?? [],
    }))
  }

  private loadSourceEvents(): EventConfig[] {
    const rows = this.db.prepare('SELECT * FROM source_events').all() as Array<{
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

  private loadSourceMedia() {
    const rows = this.db.prepare('SELECT * FROM source_media').all() as Array<{
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

  private loadSourceTransitions(): TransitionDefinition[] {
    const rows = this.db.prepare('SELECT * FROM source_transitions').all() as Array<{
      id: string; label: string; type: string; params_json: string;
    }>
    return rows.map((row) => ({
      id: row.id,
      label: row.label,
      type: row.type,
      params: parseJson(row.params_json, undefined),
    }))
  }

  // ── Private: Write ───────────────────────────────────────────

  private writeSections(cfg: AppConfig, keys: ReadonlyArray<keyof AppConfig>): void {
    const writeTransaction = this.db.transaction(() => {
      for (const key of keys) {
        switch (key) {
          case 'scenes':           this.saveScenes(cfg.scenes); break
          case 'applications':     this.saveApplications(cfg.applications); break
          case 'keybinds':         this.saveKeybinds(cfg.keybinds); break
          case 'obs':              this.saveObsConfig(cfg.obs); break
          case 'audio':            this.saveAudioConfig(cfg.audio); break
          case 'desktopConfig':    if (cfg.desktopConfig) this.saveDesktopConfig(cfg.desktopConfig); break
          case 'desktopAmbiance':  if (cfg.desktopAmbiance) this.saveDesktopAmbiance(cfg.desktopAmbiance); break
          case 'widgetLayouts':    this.saveWidgetLayouts(cfg.widgetLayouts ?? []); break
          case 'sourceEvents':     this.saveSourceEvents(cfg.sourceEvents ?? []); break
          case 'sourceMedia':      this.saveSourceMedia(cfg.sourceMedia ?? []); break
          case 'sourcePresets':    this.saveSourcePresets(cfg.sourcePresets ?? []); break
          case 'sourceTransitions': this.saveSourceTransitions(cfg.sourceTransitions ?? []); break
        }
      }
    })
    writeTransaction()
  }

  private saveScenes(scenes: Record<string, Scene>): void {
    this.db.prepare('DELETE FROM scenes').run()
    const insert = this.db.prepare(`
      INSERT INTO scenes (id, label, background_opaque, sources_json, style_json, lobby_config_json, on_entry_json, on_exit_json, music_track)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const scene of Object.values(scenes)) {
      insert.run(
        scene.id,
        scene.label,
        boolToInt(scene.backgroundOpaque),
        JSON.stringify(scene.sources ?? []),
        scene.style ? JSON.stringify(scene.style) : null,
        scene.lobbyConfig ? JSON.stringify(scene.lobbyConfig) : null,
        JSON.stringify(scene.onEntry ?? []),
        JSON.stringify(scene.onExit ?? []),
        scene.musicTrack ?? null,
      )
    }
  }

  private saveApplications(applications: Application[]): void {
    this.db.prepare('DELETE FROM applications').run()
    const insert = this.db.prepare(`
      INSERT INTO applications (id, label, icon, app_type, target_scene_id, widget_source, widget_component,
        icon_position_x, icon_position_y, icon_size,
        window_x, window_y, window_width, window_height, z_index_default, z_index_current,
        settings_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    // Server-side label sync: when a scene-type app saves, update its linked scene label
    const updateSceneLabel = this.db.prepare('UPDATE scenes SET label = ? WHERE id = ?')

    for (const app of applications) {
      const settings: Record<string, unknown> = {}
      if (app.transitionType) settings.transitionType = app.transitionType
      if (app.launchPipeline) settings.launchPipeline = app.launchPipeline
      if (app.gallerySettings) settings.gallerySettings = app.gallerySettings
      if (app.cameraSettings) settings.cameraSettings = app.cameraSettings
      if (app.sourceWidgetSettings) settings.sourceWidgetSettings = app.sourceWidgetSettings
      if (app.stickyNotesSettings) settings.stickyNotesSettings = app.stickyNotesSettings
      if (app.recycleBinSettings) settings.recycleBinSettings = app.recycleBinSettings
      if (app.themeOverride) settings.themeOverride = app.themeOverride
      if (app.onlineStreamSettings) settings.onlineStreamSettings = app.onlineStreamSettings

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
        app.windowPosition?.x ?? null,
        app.windowPosition?.y ?? null,
        app.windowSize?.width ?? null,
        app.windowSize?.height ?? null,
        app.zIndexDefault ?? null,
        app.zIndexCurrent ?? null,
        Object.keys(settings).length > 0 ? JSON.stringify(settings) : null,
      )

      // Task 7: sync linked scene label server-side
      if (app.appType === 'scene' && app.targetSceneId) {
        updateSceneLabel.run(app.label, app.targetSceneId)
      }
    }
  }

  private saveKeybinds(keybinds: AppConfig['keybinds']): void {
    this.db.prepare('DELETE FROM keybinds').run()
    const insert = this.db.prepare('INSERT INTO keybinds (scope, key, action) VALUES (?, ?, ?)')
    for (const [key, action] of Object.entries(keybinds.obs ?? {})) insert.run('obs', key, action)
    for (const [key, action] of Object.entries(keybinds.admin ?? {})) insert.run('admin', key, action)
  }

  private saveObsConfig(obs: AppConfig['obs']): void {
    this.db.prepare('INSERT OR REPLACE INTO obs_config (id, url, password) VALUES (1, ?, ?)').run(obs.url, obs.password)
  }

  private saveAudioConfig(audio: AppConfig['audio']): void {
    this.db.prepare('INSERT OR REPLACE INTO audio_config (id, master_volume, sfx_volume, music_volume) VALUES (1, ?, ?, ?)')
      .run(audio.masterVolume, audio.sfxVolume, audio.musicVolume)
  }

  private saveDesktopConfig(dc: DesktopConfig): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO desktop_config (id, global_theme_json, icon_animation, icon_arrangement,
        icon_motion, icon_arrangement_motion, default_icon_size, auto_arrange_icons,
        recycle_bin_json, screen_saver_json, system_sounds_json)
      VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    )
  }

  private saveDesktopAmbiance(ambiance: NonNullable<AppConfig['desktopAmbiance']>): void {
    this.db.prepare('INSERT OR REPLACE INTO desktop_ambiance (id, simulation_json) VALUES (1, ?)').run(JSON.stringify(ambiance))
  }

  private saveWidgetLayouts(layouts: WidgetLayoutDefinition[]): void {
    const userLayouts = layouts.filter((l) => l.source !== 'system')
    const deleteItems  = this.db.prepare('DELETE FROM widget_layout_items WHERE layout_id = ?')
    const deleteLayout = this.db.prepare('DELETE FROM widget_layouts WHERE id = ? AND source = ?')
    const upsertLayout = this.db.prepare(
      'INSERT OR REPLACE INTO widget_layouts (id, label, icon, source, description, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
    )
    const insertItem = this.db.prepare(
      'INSERT INTO widget_layout_items (layout_id, widget_id, enabled, x, y, width, height, focus_priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )

    const existingUserIds = (this.db.prepare("SELECT id FROM widget_layouts WHERE source = 'user'").all() as { id: string }[]).map((r) => r.id)
    const incomingIds = new Set(userLayouts.map((l) => l.id))
    for (const id of existingUserIds) {
      if (!incomingIds.has(id)) { deleteItems.run(id); deleteLayout.run(id, 'user') }
    }

    for (let i = 0; i < userLayouts.length; i++) {
      const layout = userLayouts[i]
      deleteItems.run(layout.id)
      upsertLayout.run(layout.id, layout.label, layout.icon, 'user', layout.description ?? null, i)
      for (const item of layout.items) {
        insertItem.run(layout.id, item.widgetId, item.enabled ? 1 : 0, item.x, item.y, item.width, item.height, item.focusPriority)
      }
    }
  }

  private saveSourceEvents(events: EventConfig[]): void {
    this.db.prepare('DELETE FROM source_events').run()
    const insert = this.db.prepare(`
      INSERT INTO source_events (id, label, icon, color, "desc", effects_json, actions_json, auto_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const event of events) {
      insert.run(
        event.id, event.label, event.icon ?? '', event.color ?? '', event.desc ?? '',
        JSON.stringify(event.effects ?? []),
        event.actions ? JSON.stringify(event.actions) : null,
        JSON.stringify(event.auto ?? { enabled: false, intervalMs: 0 }),
      )
    }
  }

  private saveSourceMedia(entries: NonNullable<AppConfig['sourceMedia']>): void {
    this.db.prepare('DELETE FROM source_media').run()
    const insert = this.db.prepare('INSERT INTO source_media (id, name, type, url, duration) VALUES (?, ?, ?, ?, ?)')
    for (const entry of entries) {
      insert.run(entry.id, entry.name, entry.type, entry.url, entry.duration ?? null)
    }
  }

  private saveSourcePresets(presets: NonNullable<AppConfig['sourcePresets']>): void {
    this.db.prepare('DELETE FROM source_presets').run()
    const insert = this.db.prepare(
      'INSERT INTO source_presets (id, label, plugin_type, config_json, default_position_json) VALUES (?, ?, ?, ?, ?)'
    )
    for (const preset of presets) {
      insert.run(
        preset.id, preset.label, preset.pluginType,
        JSON.stringify(preset.config ?? {}),
        preset.defaultPosition ? JSON.stringify(preset.defaultPosition) : null,
      )
    }
  }

  private saveSourceTransitions(transitions: TransitionDefinition[]): void {
    this.db.prepare('DELETE FROM source_transitions').run()
    const insert = this.db.prepare('INSERT INTO source_transitions (id, label, type, params_json) VALUES (?, ?, ?, ?)')
    for (const t of transitions) {
      insert.run(t.id, t.label, t.type, JSON.stringify(t.params ?? {}))
    }
  }

  // ── Private: Config Defaults ─────────────────────────────────

  private withConfigDefaults(next: AppConfig): AppConfig {
    const requiredApps = DEFAULT_CONFIG.applications.filter((app) => REQUIRED_DESKTOP_APP_IDS.has(app.id))
    let applications = [...(next.applications ?? [])]
    const lobbyScene   = next.scenes[STATE.LOBBY]   ?? DEFAULT_CONFIG.scenes[STATE.LOBBY]
    const desktopScene = next.scenes[STATE.DESKTOP] ?? DEFAULT_CONFIG.scenes[STATE.DESKTOP]

    for (const app of requiredApps) {
      if (!applications.some((existing) => existing.id === app.id)) {
        applications.push(structuredClone(app))
      }
    }

    applications = withApplicationListDefaults(applications)
    const desktopConfig = withDesktopConfigDefaults(next.desktopConfig)
    applications = applications.map((app) => ({
      ...app,
      defaultConfig: app.defaultConfig ? clone(app.defaultConfig) : buildApplicationDefaultSnapshot(app),
    }))

    const scenes: AppConfig['scenes'] = {
      ...next.scenes,
      [STATE.LOBBY]: {
        ...DEFAULT_CONFIG.scenes[STATE.LOBBY],
        ...lobbyScene,
        style: withOverlayStyleDefaults(lobbyScene.style),
        lobbyConfig: withLobbyConfigDefaults(lobbyScene.lobbyConfig),
      },
      [STATE.DESKTOP]: {
        ...DEFAULT_CONFIG.scenes[STATE.DESKTOP],
        ...desktopScene,
        style: withOverlayStyleDefaults(desktopScene.style),
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
      desktopConfig,
      desktopAmbiance: withDesktopAmbianceDefaults(next.desktopAmbiance ?? {}),
      widgetLayouts: next.widgetLayouts ?? [],
      sourceEvents: withEventListDefaults(next.sourceEvents?.length ? next.sourceEvents : structuredClone(DEFAULT_CONFIG.sourceEvents)),
      sourceMedia: next.sourceMedia ?? [],
      sourcePresets: next.sourcePresets ?? [],
      sourceTransitions: next.sourceTransitions ?? [],
    }
  }

  // ── Atomic scene creation (Task 9) ───────────────────────────

  createScene(app: Application, scene: Scene): AppConfig {
    this.db.transaction(() => {
      // Insert scene
      this.db.prepare(`
        INSERT INTO scenes (id, label, background_opaque, sources_json, style_json, lobby_config_json, on_entry_json, on_exit_json, music_track)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        scene.id, scene.label, boolToInt(scene.backgroundOpaque),
        JSON.stringify(scene.sources ?? []),
        scene.style ? JSON.stringify(scene.style) : null,
        null,
        JSON.stringify([]), JSON.stringify([]), null,
      )
      // Insert application
      this.db.prepare(`
        INSERT INTO applications (id, label, icon, app_type, target_scene_id, widget_source, widget_component,
          icon_position_x, icon_position_y, icon_size, window_x, window_y, window_width, window_height,
          z_index_default, z_index_current, settings_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        app.id, app.label, app.icon ?? '', app.appType, app.targetSceneId ?? '',
        null, null,
        app.iconPosition?.x ?? null, app.iconPosition?.y ?? null, app.iconSize ?? null,
        null, null, null, null, null, null,
        app.transitionType ? JSON.stringify({ transitionType: app.transitionType }) : null,
      )
    })()

    // Invalidate cache so next read returns fresh data
    this._cachedConfig = null
    return this.withConfigDefaults(this.loadFromDb())
  }
}
