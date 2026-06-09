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
} from '@ieomlabs/shared'
import type {
  AppConfig,
  Application,
  DesktopConfig,
  Manager,
  ManagerStatus,
  Scene,
  WidgetLayoutDefinition,
  TransitionDefinition,
} from '@ieomlabs/shared'
import type { EventConfig } from '@ieomlabs/shared'
import { SceneRepository } from '../../db/repositories/SceneRepository.js'
import { WidgetRepository } from '../../db/repositories/WidgetRepository.js'
import { EventRepository } from '../../db/repositories/EventRepository.js'
import { ThemeRepository } from '../../db/repositories/ThemeRepository.js'
import { ReactiveChainRepository } from '../../db/repositories/ReactiveChainRepository.js'

type DesktopDatabase = Database.Database

// ── Helpers ──────────────────────────────────────────────────────

function boolToInt(value: boolean | undefined): number {
  return value ? 1 : 0
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

const REQUIRED_DESKTOP_APP_IDS = new Set(
  DEFAULT_CONFIG.applications
    .filter((app) => app.widgetSource === 'system')
    .map((app) => app.id),
)

function getSeedAppSource(app: Application) {
  return DEFAULT_CONFIG.applications.find((entry) => entry.id === app.id) ?? app
}

function getSeedSceneSource(sceneId: string, scene: Scene) {
  return DEFAULT_CONFIG.scenes[sceneId] ?? scene
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
  readonly bootPriority = 0
  private _status: ManagerStatus = 'idle'
  private _cachedConfig: AppConfig | null = null

  get cachedConfig(): AppConfig | null { return this._cachedConfig }
  private onConfigUpdateListener: ((config: AppConfig) => void) | null = null

  private readonly sceneRepo: SceneRepository
  private readonly widgetRepo: WidgetRepository
  private readonly eventRepo: EventRepository
  private readonly themeRepo: ThemeRepository
  readonly reactiveChains: ReactiveChainRepository

  constructor(
    private db: DesktopDatabase,
    private io: SocketIOServer | null = null,
  ) {
    this.sceneRepo = new SceneRepository(db)
    this.widgetRepo = new WidgetRepository(db)
    this.eventRepo = new EventRepository(db)
    this.themeRepo = new ThemeRepository(db)
    this.reactiveChains = new ReactiveChainRepository(db)

    // Ensure required tables exist
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
      );
      CREATE TABLE IF NOT EXISTS reactive_chains (
        id TEXT PRIMARY KEY,
        trigger_widget_id TEXT NOT NULL,
        trigger_event TEXT NOT NULL,
        target_widget_id TEXT NOT NULL,
        target_action TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1
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

  /**
   * Route an incoming widget signal through the reactive-chains table.
   * Returns the list of target actions that were triggered.
   */
  routeWidgetSignal(source: string, event: string): Array<{ targetWidgetId: string; targetAction: string }> {
    return this.reactiveChains.list()
      .filter((c) => c.enabled && c.triggerWidgetId === source && c.triggerEvent === event)
      .map((c) => ({ targetWidgetId: c.targetWidgetId, targetAction: c.targetAction }))
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
      scenes:           this.sceneRepo.load(),
      applications:     this.widgetRepo.loadApplications(),
      keybinds:         this.loadKeybinds(),
      obs:              this.loadObsConfig(),
      audio:            this.loadAudioConfig(),
      desktopConfig:    this.themeRepo.loadDesktopConfig(),
      desktopAmbiance:  this.themeRepo.loadDesktopAmbiance(),
      widgetLayouts:    this.widgetRepo.loadLayouts(),
      sourceEvents:     this.eventRepo.load(),
      sourceMedia:      this.loadSourceMedia(),
      sourcePresets:    this.loadSourcePresets(),
      sourceTransitions: this.loadSourceTransitions(),
    }
    return this.withConfigDefaults(base)
  }

  private loadScenes(): Record<string, Scene> { return this.sceneRepo.load() }
  private loadApplications(): Application[] { return this.widgetRepo.loadApplications() }
  private loadSourceEvents(): EventConfig[] { return this.eventRepo.load() }
  private loadDesktopConfig(): DesktopConfig | undefined { return this.themeRepo.loadDesktopConfig() }
  private loadDesktopAmbiance() { return this.themeRepo.loadDesktopAmbiance() }
  private loadWidgetLayouts(): WidgetLayoutDefinition[] { return this.widgetRepo.loadLayouts() }

  private loadKeybinds(): AppConfig['keybinds'] {
    const rows = this.db.prepare('SELECT * FROM keybinds').all() as Array<{ scope: string; key: string; action: string }>
    const obs: Record<string, string> = {}
    const admin: Record<string, string> = {}
    for (const row of rows) {
      if (row.scope === 'obs') obs[row.key] = row.action
      else if (row.scope === 'admin') admin[row.key] = row.action
    }
    return { obs, admin }
  }

  private loadObsConfig(): AppConfig['obs'] {
    const row = this.db.prepare('SELECT * FROM obs_config WHERE id = 1').get() as { url: string; password: string } | undefined
    return row ? { url: row.url, password: row.password } : { url: '', password: '' }
  }

  private loadAudioConfig(): AppConfig['audio'] {
    const row = this.db.prepare('SELECT * FROM audio_config WHERE id = 1').get() as { master_volume: number; sfx_volume: number; music_volume: number } | undefined
    return row
      ? { masterVolume: row.master_volume, sfxVolume: row.sfx_volume, musicVolume: row.music_volume }
      : { masterVolume: 1, sfxVolume: 1, musicVolume: 0.7 }
  }

  private loadSourceMedia() {
    const rows = this.db.prepare('SELECT * FROM source_media').all() as Array<{
      id: string; name: string; type: string; url: string; duration: number | null;
    }>
    return rows.map((row) => ({ id: row.id, name: row.name, type: row.type as 'image' | 'video', url: row.url, duration: row.duration ?? undefined }))
  }

  private loadSourcePresets() {
    const rows = this.db.prepare('SELECT * FROM source_presets').all() as Array<{
      id: string; label: string; plugin_type: string; config_json: string; default_position_json: string | null;
    }>
    return rows.map((row) => ({
      id: row.id, label: row.label, pluginType: row.plugin_type,
      config: this._parseJson(row.config_json, {}),
      defaultPosition: this._parseJson(row.default_position_json, undefined),
    }))
  }

  private loadSourceTransitions(): TransitionDefinition[] {
    const rows = this.db.prepare('SELECT * FROM source_transitions').all() as Array<{
      id: string; label: string; type: string; params_json: string;
    }>
    return rows.map((row) => ({ id: row.id, label: row.label, type: row.type, params: this._parseJson(row.params_json, undefined) }))
  }

  private _parseJson<T>(v: string | null | undefined, fallback: T): T {
    if (!v) return fallback; try { return JSON.parse(v) as T } catch { return fallback }
  }

  // ── Private: Write ───────────────────────────────────────────

  private writeSections(cfg: AppConfig, keys: ReadonlyArray<keyof AppConfig>): void {
    const writeTransaction = this.db.transaction(() => {
      for (const key of keys) {
        switch (key) {
          case 'scenes':           this.sceneRepo.save(cfg.scenes); break
          case 'applications':     this.widgetRepo.saveApplications(cfg.applications); break
          case 'keybinds':         this.saveKeybinds(cfg.keybinds); break
          case 'obs':              this.saveObsConfig(cfg.obs); break
          case 'audio':            this.saveAudioConfig(cfg.audio); break
          case 'desktopConfig':    if (cfg.desktopConfig) this.themeRepo.saveDesktopConfig(cfg.desktopConfig); break
          case 'desktopAmbiance':  if (cfg.desktopAmbiance) this.themeRepo.saveDesktopAmbiance(cfg.desktopAmbiance); break
          case 'widgetLayouts':    this.widgetRepo.saveLayouts(cfg.widgetLayouts ?? []); break
          case 'sourceEvents':     this.eventRepo.save(cfg.sourceEvents ?? []); break
          case 'sourceMedia':      this.saveSourceMedia(cfg.sourceMedia ?? []); break
          case 'sourcePresets':    this.saveSourcePresets(cfg.sourcePresets ?? []); break
          case 'sourceTransitions': this.saveSourceTransitions(cfg.sourceTransitions ?? []); break
        }
      }
    })
    writeTransaction()
  }

  private saveScenes(scenes: Record<string, Scene>): void { this.sceneRepo.save(scenes) }
  private saveApplications(applications: Application[]): void { this.widgetRepo.saveApplications(applications) }
  private saveSourceEvents(events: EventConfig[]): void { this.eventRepo.save(events) }
  private saveDesktopConfig(dc: DesktopConfig): void { this.themeRepo.saveDesktopConfig(dc) }
  private saveDesktopAmbiance(ambiance: NonNullable<AppConfig['desktopAmbiance']>): void { this.themeRepo.saveDesktopAmbiance(ambiance) }
  private saveWidgetLayouts(layouts: WidgetLayoutDefinition[]): void { this.widgetRepo.saveLayouts(layouts) }

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

  // ── Atomic scene creation ────────────────────────────────────

  createScene(_app: Application, scene: Scene): AppConfig {
    this.db.transaction(() => {
      this.db.prepare(`
        INSERT INTO scenes (id, label, background_opaque, sources_json, style_json, lobby_config_json, on_entry_json, on_exit_json, music_track, show_desktop)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        scene.id, scene.label, boolToInt(scene.backgroundOpaque),
        JSON.stringify(scene.sources ?? []),
        scene.style ? JSON.stringify(scene.style) : null,
        null, JSON.stringify([]), JSON.stringify([]), null, 0,
      )
    })()
    this._cachedConfig = null
    return this.withConfigDefaults(this.loadFromDb())
  }
}
