/**
 * Desktop-mode ConfigService backed by SQLite (better-sqlite3).
 *
 * Single-tenant: no user_id scoping. All queries operate on a flat schema.
 * Implements the same interface as the multi-tenant ConfigService so it can
 * be used as a drop-in replacement in desktop-entry.ts.
 */

import type Database from 'better-sqlite3'
import type { Server as SocketIOServer } from 'socket.io'
import type { KernelBus } from '../bus.js'
import {
  DEFAULT_CONFIG,
  STATE,
  withApplicationListDefaults,
  withDesktopAmbianceDefaults,
  withEffectStormsDefaults,
  withDesktopConfigDefaults,
  withEventListDefaults,
  withOverlayStyleDefaults,
} from '@ieomlabs/shared'
import type {
  AppConfig,
  Application,
  ConfigPreset,
  DesktopConfig,
  Manager,
  ManagerStatus,
  Scene,
  Sequence,
  WidgetLayoutDefinition,
} from '@ieomlabs/shared'
import type { EventConfig } from '@ieomlabs/shared'
import { SceneRepository } from '../../db/repositories/SceneRepository.js'
import { WidgetRepository } from '../../db/repositories/WidgetRepository.js'
import { EventRepository } from '../../db/repositories/EventRepository.js'
import { ThemeRepository } from '../../db/repositories/ThemeRepository.js'
import { AutomationRuleRepository } from '../../db/repositories/AutomationRuleRepository.js'
import { ConfigPresetRepository } from '../../db/repositories/ConfigPresetRepository.js'
import { SequenceRepository } from '../../db/repositories/SequenceRepository.js'
import { MiscConfigRepository } from '../../db/repositories/MiscConfigRepository.js'

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
    windows: clone(source.windows ?? []),
    style: source.style ? clone(source.style) : undefined,
    introSequenceId: source.introSequenceId,
    exitSequenceId: source.exitSequenceId,
    introSteps: source.introSteps ? clone(source.introSteps) : undefined,
    exitSteps: source.exitSteps ? clone(source.exitSteps) : undefined,
  }
}

// ── IConfigService ───────────────────────────────────────────────

export interface IConfigService {
  readonly cachedConfig: AppConfig | null
  getForUser(userId: string): Promise<AppConfig>
  persistForUser(userId: string, config: AppConfig, updates?: Partial<AppConfig>): Promise<AppConfig>
  upsertScene(scene: Scene): Promise<void>
  deleteScene(id: string): Promise<void>
  upsertApplication(app: Application): Promise<void>
  onConfigUpdate(listener: (config: AppConfig) => void): void
  invalidateCache(): void
  applyPreset(id: string): Promise<AppConfig>
  listSequences(): Sequence[]
  getSequence(id: string): Sequence | undefined
}

// ── DesktopConfigService ─────────────────────────────────────────

export class DesktopConfigService implements Manager, IConfigService {
  readonly name = 'DesktopConfigService'
  readonly bootPriority = 0
  private _status: ManagerStatus = 'idle'
  private _cachedConfig: AppConfig | null = null

  get cachedConfig(): AppConfig | null { return this._cachedConfig }
  private onConfigUpdateListeners: Array<(config: AppConfig) => void> = []

  private readonly sceneRepo: SceneRepository
  private readonly widgetRepo: WidgetRepository
  private readonly eventRepo: EventRepository
  private readonly themeRepo: ThemeRepository
  private readonly presetRepo: ConfigPresetRepository
  private readonly sequenceRepo: SequenceRepository
  private readonly miscRepo: MiscConfigRepository
  readonly automationRules: AutomationRuleRepository

  constructor(
    private db: DesktopDatabase,
    private io: SocketIOServer | null = null,
    private bus: KernelBus | null = null,
  ) {
    this.sceneRepo = new SceneRepository(db)
    this.widgetRepo = new WidgetRepository(db)
    this.eventRepo = new EventRepository(db)
    this.themeRepo = new ThemeRepository(db)
    this.automationRules = new AutomationRuleRepository(db)
    this.presetRepo = new ConfigPresetRepository(db)
    this.sequenceRepo = new SequenceRepository(db)
    this.miscRepo = new MiscConfigRepository(db)

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
      )
    `)

  }

  init(): void { this._status = 'idle' }
  start(): void { this._status = 'running' }
  stop(): void { this._status = 'stopped' }
  dispose(): void { this._status = 'stopped' }
  status(): ManagerStatus { return this._status }

  onConfigUpdate(listener: (config: AppConfig) => void) {
    this.onConfigUpdateListeners.push(listener)
  }

  invalidateCache(): void {
    this._cachedConfig = null
  }

  async getForUser(_userId: string): Promise<AppConfig> {
    if (this._cachedConfig) return this._cachedConfig
    const config = this.loadFromDb()
    this._cachedConfig = config
    for (const listener of this.onConfigUpdateListeners) {
      listener(config)
    }
    return config
  }

  async upsertScene(scene: Scene): Promise<void> {
    this.sceneRepo.upsert(scene)
    const current = this._cachedConfig ?? this.loadFromDb()
    const scenes = { ...current.scenes, [scene.id]: scene }
    this._cachedConfig = { ...current, scenes }
    const patch = { scenes }
    this.io?.emit('config:patch', patch)
    this.bus?.emit('config:changed', { section: 'scenes' })
    for (const listener of this.onConfigUpdateListeners) listener(this._cachedConfig)
  }

  async deleteScene(id: string): Promise<void> {
    this.sceneRepo.delete(id)
    const current = this._cachedConfig ?? this.loadFromDb()
    const { [id]: _removed, ...scenes } = current.scenes
    this._cachedConfig = { ...current, scenes }
    const patch = { scenes }
    this.io?.emit('config:patch', patch)
    this.bus?.emit('config:changed', { section: 'scenes' })
    for (const listener of this.onConfigUpdateListeners) listener(this._cachedConfig)
  }

  async upsertApplication(app: Application): Promise<void> {
    this.widgetRepo.upsertApplication(app)
    const current = this._cachedConfig ?? this.loadFromDb()
    const exists = current.applications.some((a) => a.id === app.id)
    const applications = exists
      ? current.applications.map((a) => a.id === app.id ? app : a)
      : [...current.applications, app]
    this._cachedConfig = { ...current, applications }
    const patch = { applications }
    this.io?.emit('config:patch', patch)
    this.bus?.emit('config:changed', { section: 'applications' })
    for (const listener of this.onConfigUpdateListeners) listener(this._cachedConfig)
  }

  async persistForUser(_userId: string, next: AppConfig, updates?: Partial<AppConfig>): Promise<AppConfig> {
    const config = this.withConfigDefaults(next)

    if (updates) {
      this.writeSections(config, Object.keys(updates) as Array<keyof AppConfig>)
    } else {
      this.writeSections(config, [
        'scenes', 'applications', 'keybinds', 'obs', 'audio',
        'desktopConfig', 'desktopAmbiance', 'widgetLayouts',
        'sourceEvents', 'sourceMedia', 'windowPresets', 'shows',
        'effectAmbiance', 'effectStorms', 'desktopThemeDrift', 'persona',
        'avatarPresets',
      ])
    }

    this._cachedConfig = config

    if (this.io) {
      // Delta saves broadcast only the changed sections; the full config
      // replace is reserved for full (non-patch) saves so clients don't
      // reprocess the entire AppConfig on every incremental edit.
      if (updates && Object.keys(updates).length > 0) {
        this.io.emit('config:patch', updates)
      } else {
        this.io.emit('config:update', config)
      }
    }

    if (this.bus) {
      const sections = updates ? Object.keys(updates) : ['all']
      for (const section of sections) {
        this.bus.emit('config:changed', { section })
      }
    }

    if (this.onConfigUpdateListeners.length > 0) {
      for (const listener of this.onConfigUpdateListeners) {
        listener(config)
      }
    }
    return config
  }

  // ── Config presets ───────────────────────────────────────────

  listPresets(): ConfigPreset[] {
    return this.presetRepo.list()
  }

  savePreset(label: string, sectionKeys: Array<keyof AppConfig>, explicitSections?: Partial<AppConfig>): ConfigPreset {
    let sections: Partial<AppConfig>
    if (explicitSections) {
      // Imported bundle: trust the caller's section payload as-is (already
      // validated shape-wise by the route), just clone to detach references.
      sections = clone(explicitSections)
    } else {
      const current = this._cachedConfig ?? this.loadFromDb()
      sections = {}
      for (const key of sectionKeys) {
        sections[key] = clone(current[key]) as never
      }
    }
    const preset: ConfigPreset = {
      id: crypto.randomUUID(),
      label,
      sections,
      createdAt: Date.now(),
    }
    this.presetRepo.upsert(preset)
    return preset
  }

  async applyPreset(id: string): Promise<AppConfig> {
    const preset = this.presetRepo.get(id)
    if (!preset) throw new Error(`Config preset not found: ${id}`)
    const current = this._cachedConfig ?? this.loadFromDb()
    const next = { ...current, ...preset.sections }
    return this.persistForUser('', next, preset.sections)
  }

  deletePreset(id: string): void {
    this.presetRepo.delete(id)
  }

  // ── Sequences ─────────────────────────────────────────────────

  listSequences(): Sequence[] {
    return this.sequenceRepo.list()
  }

  getSequence(id: string): Sequence | undefined {
    return this.sequenceRepo.get(id)
  }

  createSequence(label: string, steps: Sequence['steps']): Sequence {
    const seq: Sequence = { id: crypto.randomUUID(), label, steps }
    this.sequenceRepo.upsert(seq)
    return seq
  }

  updateSequence(id: string, patch: { label?: string; steps?: Sequence['steps'] }): Sequence {
    const current = this.sequenceRepo.get(id)
    if (!current) throw new Error(`Sequence not found: ${id}`)
    const next: Sequence = { ...current, ...patch }
    this.sequenceRepo.upsert(next)
    return next
  }

  deleteSequence(id: string): void {
    this.sequenceRepo.delete(id)
  }

  // ── Private: Load ────────────────────────────────────────────

  private loadFromDb(): AppConfig {
    const base: AppConfig = {
      scenes:           this.sceneRepo.load(),
      applications:     this.widgetRepo.loadApplications(),
      keybinds:         this.miscRepo.loadKeybinds(),
      obs:              this.miscRepo.loadObsConfig(),
      audio:            this.miscRepo.loadAudioConfig(),
      desktopConfig:    this.themeRepo.loadDesktopConfig(),
      desktopAmbiance:  this.themeRepo.loadDesktopAmbiance(),
      widgetLayouts:    this.widgetRepo.loadLayouts(),
      sourceEvents:     this.eventRepo.load(),
      sourceMedia:      this.miscRepo.loadSourceMedia(),
      windowPresets:    this.miscRepo.loadWindowPresets(),
      automationRules:  this.automationRules.list(),
      shows:            this.miscRepo.loadShows(),
      twitch:           this.miscRepo.loadTwitchConfig(),
      chatReactions:    this.miscRepo.loadChatReactions(),
      effectAmbiance:   this.themeRepo.loadEffectAmbiance(),
      effectStorms:     this.themeRepo.loadEffectStorms(),
      desktopThemeDrift: this.themeRepo.loadDesktopThemeDrift(),
      persona:          this.themeRepo.loadPersonaConfig(),
      avatarPresets:    this.miscRepo.loadAvatarPresets(),
    }
    return this.withConfigDefaults(base)
  }

  // ── Private: Write ───────────────────────────────────────────

  private writeSections(cfg: AppConfig, keys: ReadonlyArray<keyof AppConfig>): void {
    const writeTransaction = this.db.transaction(() => {
      for (const key of keys) {
        switch (key) {
          case 'scenes':           this.sceneRepo.save(cfg.scenes); break
          case 'applications':     this.widgetRepo.saveApplications(cfg.applications); break
          case 'keybinds':         this.miscRepo.saveKeybinds(cfg.keybinds); break
          case 'obs':              this.miscRepo.saveObsConfig(cfg.obs); break
          case 'audio':            this.miscRepo.saveAudioConfig(cfg.audio); break
          case 'desktopConfig':    if (cfg.desktopConfig) this.themeRepo.saveDesktopConfig(cfg.desktopConfig); break
          case 'desktopAmbiance':  if (cfg.desktopAmbiance) this.themeRepo.saveDesktopAmbiance(cfg.desktopAmbiance); break
          case 'widgetLayouts':    this.widgetRepo.saveLayouts(cfg.widgetLayouts ?? []); break
          case 'sourceEvents':     this.eventRepo.save(cfg.sourceEvents ?? []); break
          case 'sourceMedia':      this.miscRepo.saveSourceMedia(cfg.sourceMedia ?? []); break
          case 'windowPresets':    this.miscRepo.saveWindowPresets(cfg.windowPresets ?? []); break
          case 'shows':            this.miscRepo.saveShows(cfg.shows ?? []); break
          case 'twitch':           if (cfg.twitch) this.miscRepo.saveTwitchConfig(cfg.twitch); break
          case 'chatReactions':    this.miscRepo.saveChatReactions(cfg.chatReactions ?? []); break
          case 'effectAmbiance':   if (cfg.effectAmbiance) this.themeRepo.saveEffectAmbiance(cfg.effectAmbiance); break
          case 'effectStorms':     if (cfg.effectStorms) this.themeRepo.saveEffectStorms(cfg.effectStorms); break
          case 'desktopThemeDrift': if (cfg.desktopThemeDrift) this.themeRepo.saveDesktopThemeDrift(cfg.desktopThemeDrift); break
          case 'persona':          if (cfg.persona) this.themeRepo.savePersonaConfig(cfg.persona); break
          case 'avatarPresets':    this.miscRepo.saveAvatarPresets(cfg.avatarPresets ?? []); break
        }
      }
    })
    writeTransaction()
  }

  // ── Private: Config Defaults ─────────────────────────────────

  private withConfigDefaults(next: AppConfig): AppConfig {
    const requiredApps = DEFAULT_CONFIG.applications.filter((app) => REQUIRED_DESKTOP_APP_IDS.has(app.id))
    // Retired widgets: drop persisted app entries whose component no longer exists.
    let applications = [...(next.applications ?? [])].filter(
      (app) => (app.widgetComponent as string | undefined) !== 'persona-avatar',
    )
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
      effectStorms: withEffectStormsDefaults(next.effectStorms, next.effectAmbiance),
      widgetLayouts: next.widgetLayouts ?? [],
      sourceEvents: withEventListDefaults(next.sourceEvents ?? []),
      sourceMedia: next.sourceMedia ?? [],
      windowPresets: next.windowPresets ?? [],
      automationRules: next.automationRules ?? [],
      shows: next.shows ?? [],
    }
  }

  // ── Atomic scene creation ────────────────────────────────────

  createScene(_app: Application, scene: Scene): AppConfig {
    this.db.transaction(() => {
      this.db.prepare(`
        INSERT INTO scenes (id, label, background_opaque, windows_json, style_json, intro_sequence_id, exit_sequence_id, ambient_track, show_desktop)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        scene.id, scene.label, boolToInt(scene.backgroundOpaque),
        JSON.stringify(scene.windows ?? []),
        scene.style ? JSON.stringify(scene.style) : null,
        null, null, null, 0,
      )
    })()
    this._cachedConfig = null
    return this.withConfigDefaults(this.loadFromDb())
  }
}
