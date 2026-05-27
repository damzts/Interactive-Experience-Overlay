import Database, { type Database as DatabaseType } from 'better-sqlite3'
import { DEFAULT_CONFIG } from '@ieom/shared'
import type {
  AppConfig,
  Application,
  DesktopAmbianceConfig,
  DesktopConfig,
  EventConfig,
  MediaEntry,
  OverlayStyle,
  Scene,
  SourcePreset,
  WidgetLayoutDefinition,
} from '@ieom/shared'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = join(__dirname, '../../../../ieom.db')

export const db: DatabaseType = new Database(DB_PATH)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

type JsonValue = string | null | undefined

type SceneTransitionsPayload = Pick<Scene, 'introTransition' | 'exitTransition' | 'introTransitions' | 'exitTransitions' | 'musicTrack'>
type ApplicationSettingsPayload = Pick<Application, 'transitionType' | 'introTransition' | 'exitTransition' | 'introTransitions' | 'exitTransitions' | 'launchPipeline' | 'gallerySettings' | 'cameraSettings' | 'sourceWidgetSettings' | 'stickyNotesSettings' | 'recycleBinSettings' | 'themeOverride'>

const DEFAULT_DESKTOP_CONFIG = DEFAULT_CONFIG.desktopConfig!

const DEFAULT_EVENT_AUTO: EventConfig['auto'] = DEFAULT_CONFIG.events?.[0]?.auto ?? {
  enabled: false,
  mode: 'interval',
  intervalMin: 60,
  idleMin: 5,
  chance: 1,
  cooldownMin: 0,
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

function parseJson<T>(value: JsonValue): T | undefined {
  if (value == null || value === '') return undefined
  return JSON.parse(value) as T
}

function boolToInt(value: boolean | undefined): number {
  return value ? 1 : 0
}

function sceneTransitions(scene: Scene): string {
  return JSON.stringify({
    introTransition: scene.introTransition,
    exitTransition: scene.exitTransition,
    introTransitions: scene.introTransitions,
    exitTransitions: scene.exitTransitions,
    musicTrack: scene.musicTrack,
  } satisfies SceneTransitionsPayload)
}

function applicationSettings(app: Application): string {
  return JSON.stringify({
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
  } satisfies ApplicationSettingsPayload)
}

function upsertScene(scene: Scene): void {
  db.prepare(`
    INSERT INTO scenes (
      id, label, background_opaque, sources_json, style_json, lobby_config_json, transitions_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      label = excluded.label,
      background_opaque = excluded.background_opaque,
      sources_json = excluded.sources_json,
      style_json = excluded.style_json,
      lobby_config_json = excluded.lobby_config_json,
      transitions_json = excluded.transitions_json
  `).run(
    scene.id,
    scene.label,
    boolToInt(scene.backgroundOpaque),
    JSON.stringify(scene.sources ?? []),
    scene.style ? JSON.stringify(scene.style) : null,
    scene.lobbyConfig ? JSON.stringify(scene.lobbyConfig) : null,
    sceneTransitions(scene),
  )
}

function upsertApplication(app: Application): void {
  db.prepare(`
    INSERT INTO applications (
      id, label, icon, app_type, target_scene_id, widget_source, widget_component,
      icon_position_x, icon_position_y, icon_size, settings_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      label = excluded.label,
      icon = excluded.icon,
      app_type = excluded.app_type,
      target_scene_id = excluded.target_scene_id,
      widget_source = excluded.widget_source,
      widget_component = excluded.widget_component,
      icon_position_x = excluded.icon_position_x,
      icon_position_y = excluded.icon_position_y,
      icon_size = excluded.icon_size,
      settings_json = excluded.settings_json
  `).run(
    app.id,
    app.label,
    app.icon,
    app.appType,
    app.targetSceneId,
    app.widgetSource ?? null,
    app.widgetComponent ?? null,
    app.iconPosition?.x ?? null,
    app.iconPosition?.y ?? null,
    app.iconSize ?? null,
    applicationSettings(app),
  )
}

function upsertDesktopConfig(cfg: DesktopConfig): void {
  db.prepare(`
    INSERT INTO desktop_config (
      id, global_theme_json, icon_animation, icon_arrangement, icon_motion, icon_arrangement_motion,
      default_icon_size, auto_arrange_icons, recycle_bin_json, screen_saver_json, system_sounds_json,
      widget_positions_json, widget_sizes_json, widget_z_indices_json, widget_default_z_indices_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      global_theme_json = excluded.global_theme_json,
      icon_animation = excluded.icon_animation,
      icon_arrangement = excluded.icon_arrangement,
      icon_motion = excluded.icon_motion,
      icon_arrangement_motion = excluded.icon_arrangement_motion,
      default_icon_size = excluded.default_icon_size,
      auto_arrange_icons = excluded.auto_arrange_icons,
      recycle_bin_json = excluded.recycle_bin_json,
      screen_saver_json = excluded.screen_saver_json,
      system_sounds_json = excluded.system_sounds_json,
      widget_positions_json = excluded.widget_positions_json,
      widget_sizes_json = excluded.widget_sizes_json,
      widget_z_indices_json = excluded.widget_z_indices_json,
      widget_default_z_indices_json = excluded.widget_default_z_indices_json
  `).run(
    1,
    JSON.stringify(cfg.globalThemeDefault),
    cfg.iconAnimation,
    cfg.iconArrangement,
    cfg.iconMotion,
    cfg.iconArrangementMotion,
    cfg.defaultIconSize,
    boolToInt(cfg.autoArrangeIcons),
    JSON.stringify(cfg.recycleBin),
    JSON.stringify(cfg.screenSaver),
    JSON.stringify(cfg.systemSounds),
    cfg.widgetPositions ? JSON.stringify(cfg.widgetPositions) : null,
    cfg.widgetSizes ? JSON.stringify(cfg.widgetSizes) : null,
    cfg.widgetZIndices ? JSON.stringify(cfg.widgetZIndices) : null,
    cfg.widgetDefaultZIndices ? JSON.stringify(cfg.widgetDefaultZIndices) : null,
  )
}

function upsertWidgetLayout(layout: WidgetLayoutDefinition): void {
  db.prepare(`
    INSERT INTO widget_layouts (
      id, label, icon, source, description, items_json, default_config_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      label = excluded.label,
      icon = excluded.icon,
      source = excluded.source,
      description = excluded.description,
      items_json = excluded.items_json,
      default_config_json = excluded.default_config_json
  `).run(
    layout.id,
    layout.label,
    layout.icon,
    layout.source,
    layout.description ?? null,
    JSON.stringify(layout.items ?? []),
    layout.defaultConfig ? JSON.stringify(layout.defaultConfig) : null,
  )
}

function upsertEvent(event: EventConfig): void {
  db.prepare(`
    INSERT INTO events (
      id, label, icon, color, desc, effects_json, actions_json, auto_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      label = excluded.label,
      icon = excluded.icon,
      color = excluded.color,
      desc = excluded.desc,
      effects_json = excluded.effects_json,
      actions_json = excluded.actions_json,
      auto_json = excluded.auto_json
  `).run(
    event.id,
    event.label,
    event.icon,
    event.color,
    event.desc,
    JSON.stringify(event.effects ?? []),
    event.actions ? JSON.stringify(event.actions) : null,
    JSON.stringify(event.auto),
  )
}

function upsertObsConfig(cfg: AppConfig['obs']): void {
  db.prepare(`
    INSERT INTO obs_config (id, url, password) VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      url = excluded.url,
      password = excluded.password
  `).run(1, cfg.url, cfg.password)
}

function upsertAudioConfig(cfg: AppConfig['audio']): void {
  db.prepare(`
    INSERT INTO audio_config (id, master_volume, sfx_volume, music_volume) VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      master_volume = excluded.master_volume,
      sfx_volume = excluded.sfx_volume,
      music_volume = excluded.music_volume
  `).run(1, cfg.masterVolume, cfg.sfxVolume, cfg.musicVolume)
}

function upsertOverlayStyle(style: OverlayStyle): void {
  db.prepare(`
    INSERT INTO overlay_style (
      id, background_json, effects_json, particles_json, font_family, accent_color, text_color
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      background_json = excluded.background_json,
      effects_json = excluded.effects_json,
      particles_json = excluded.particles_json,
      font_family = excluded.font_family,
      accent_color = excluded.accent_color,
      text_color = excluded.text_color
  `).run(
    1,
    JSON.stringify(style.background),
    JSON.stringify(style.effects),
    JSON.stringify(style.particles),
    style.fontFamily,
    style.accentColor,
    style.textColor,
  )
}

function upsertDesktopAmbiance(cfg: DesktopAmbianceConfig): void {
  db.prepare(`
    INSERT INTO desktop_ambiance (id, simulation_json) VALUES (?, ?)
    ON CONFLICT(id) DO UPDATE SET
      simulation_json = excluded.simulation_json
  `).run(1, JSON.stringify(cfg.widgetSimulation))
}

function upsertSourcePreset(preset: SourcePreset): void {
  db.prepare(`
    INSERT INTO source_presets (id, label, plugin_type, config_json, default_position_json)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      label = excluded.label,
      plugin_type = excluded.plugin_type,
      config_json = excluded.config_json,
      default_position_json = excluded.default_position_json
  `).run(
    preset.id,
    preset.label,
    preset.pluginType,
    JSON.stringify(preset.config ?? {}),
    preset.defaultPosition ? JSON.stringify(preset.defaultPosition) : null,
  )
}

function upsertMediaEntry(entry: MediaEntry): void {
  db.prepare(`
    INSERT INTO media_library (id, name, type, url, duration) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      type = excluded.type,
      url = excluded.url,
      duration = excluded.duration
  `).run(entry.id, entry.name, entry.type, entry.url, entry.duration ?? null)
}

function runMigrations(): void {
  const currentVersion = db.pragma('user_version', { simple: true }) as number

  if (currentVersion < 1) {
    db.transaction(() => {
      db.exec(`
        DROP TABLE IF EXISTS config_store;

        CREATE TABLE IF NOT EXISTS scenes (
          id TEXT PRIMARY KEY,
          label TEXT NOT NULL,
          background_opaque INTEGER NOT NULL DEFAULT 0,
          sources_json TEXT NOT NULL DEFAULT '[]',
          style_json TEXT,
          lobby_config_json TEXT,
          transitions_json TEXT
        );

        CREATE TABLE IF NOT EXISTS applications (
          id TEXT PRIMARY KEY,
          label TEXT NOT NULL,
          icon TEXT NOT NULL DEFAULT '',
          app_type TEXT NOT NULL,
          target_scene_id TEXT NOT NULL DEFAULT '',
          widget_source TEXT,
          widget_component TEXT,
          icon_position_x REAL,
          icon_position_y REAL,
          icon_size TEXT,
          settings_json TEXT
        );

        CREATE TABLE IF NOT EXISTS desktop_config (
          id INTEGER PRIMARY KEY DEFAULT 1,
          global_theme_json TEXT,
          icon_animation TEXT,
          icon_arrangement TEXT,
          icon_motion REAL,
          icon_arrangement_motion REAL,
          default_icon_size TEXT,
          auto_arrange_icons INTEGER,
          recycle_bin_json TEXT,
          screen_saver_json TEXT,
          system_sounds_json TEXT,
          widget_positions_json TEXT,
          widget_sizes_json TEXT,
          widget_z_indices_json TEXT,
          widget_default_z_indices_json TEXT
        );

        CREATE TABLE IF NOT EXISTS widget_layouts (
          id TEXT PRIMARY KEY,
          label TEXT NOT NULL,
          icon TEXT NOT NULL DEFAULT '',
          source TEXT NOT NULL DEFAULT 'user',
          description TEXT,
          items_json TEXT NOT NULL DEFAULT '[]',
          default_config_json TEXT
        );

        CREATE TABLE IF NOT EXISTS events (
          id TEXT PRIMARY KEY,
          label TEXT NOT NULL,
          icon TEXT NOT NULL DEFAULT '',
          color TEXT NOT NULL DEFAULT '',
          desc TEXT NOT NULL DEFAULT '',
          effects_json TEXT NOT NULL DEFAULT '[]',
          actions_json TEXT,
          auto_json TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS keybinds (
          scope TEXT NOT NULL,
          key TEXT NOT NULL,
          action TEXT NOT NULL,
          PRIMARY KEY(scope, key)
        );

        CREATE TABLE IF NOT EXISTS obs_config (
          id INTEGER PRIMARY KEY DEFAULT 1,
          url TEXT NOT NULL DEFAULT '',
          password TEXT NOT NULL DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS audio_config (
          id INTEGER PRIMARY KEY DEFAULT 1,
          master_volume REAL NOT NULL DEFAULT 1,
          sfx_volume REAL NOT NULL DEFAULT 1,
          music_volume REAL NOT NULL DEFAULT 0.7
        );

        CREATE TABLE IF NOT EXISTS overlay_style (
          id INTEGER PRIMARY KEY DEFAULT 1,
          background_json TEXT,
          effects_json TEXT,
          particles_json TEXT,
          font_family TEXT,
          accent_color TEXT,
          text_color TEXT
        );

        CREATE TABLE IF NOT EXISTS desktop_ambiance (
          id INTEGER PRIMARY KEY DEFAULT 1,
          simulation_json TEXT
        );

        CREATE TABLE IF NOT EXISTS source_presets (
          id TEXT PRIMARY KEY,
          label TEXT NOT NULL,
          plugin_type TEXT NOT NULL,
          config_json TEXT NOT NULL DEFAULT '{}',
          default_position_json TEXT
        );

        CREATE TABLE IF NOT EXISTS media_library (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          url TEXT NOT NULL,
          duration REAL
        );

        DELETE FROM scenes;
        DELETE FROM applications;
        DELETE FROM desktop_config;
        DELETE FROM widget_layouts;
        DELETE FROM events;
        DELETE FROM keybinds;
        DELETE FROM obs_config;
        DELETE FROM audio_config;
        DELETE FROM overlay_style;
        DELETE FROM desktop_ambiance;
        DELETE FROM source_presets;
        DELETE FROM media_library;
      `)

      for (const scene of Object.values(DEFAULT_CONFIG.scenes)) upsertScene(scene)
      for (const app of DEFAULT_CONFIG.applications) upsertApplication(app)
      if (DEFAULT_CONFIG.desktopConfig) {
        upsertDesktopConfig(DEFAULT_CONFIG.desktopConfig)
        for (const layout of DEFAULT_CONFIG.desktopConfig.widgetLayouts ?? []) upsertWidgetLayout(layout)
      }
      for (const event of DEFAULT_CONFIG.events ?? []) upsertEvent(event)
      for (const [key, action] of Object.entries(DEFAULT_CONFIG.keybinds.obs)) {
        db.prepare('INSERT INTO keybinds (scope, key, action) VALUES (?, ?, ?)').run('obs', key, action)
      }
      for (const [key, action] of Object.entries(DEFAULT_CONFIG.keybinds.admin)) {
        db.prepare('INSERT INTO keybinds (scope, key, action) VALUES (?, ?, ?)').run('admin', key, action)
      }
      upsertObsConfig(DEFAULT_CONFIG.obs)
      upsertAudioConfig(DEFAULT_CONFIG.audio)
      upsertOverlayStyle(DEFAULT_CONFIG.overlayStyle)
      if (DEFAULT_CONFIG.desktopAmbiance) upsertDesktopAmbiance(DEFAULT_CONFIG.desktopAmbiance)
      for (const preset of DEFAULT_CONFIG.sourcePresets ?? []) upsertSourcePreset(preset)
      for (const entry of DEFAULT_CONFIG.mediaLibrary ?? []) upsertMediaEntry(entry)

      db.pragma('user_version = 1')
    })()
  }
}

runMigrations()

export function hasPersistedConfig(): boolean {
  return (db.pragma('user_version', { simple: true }) as number) >= 1
}

export function loadScenes(): Record<string, Scene> {
  const rows = db.prepare('SELECT * FROM scenes').all() as Array<{
    id: string
    label: string
    background_opaque: number
    sources_json: string
    style_json: string | null
    lobby_config_json: string | null
    transitions_json: string | null
  }>

  return Object.fromEntries(rows.map((row) => {
    const transitions = parseJson<SceneTransitionsPayload>(row.transitions_json) ?? {}
    const scene: Scene = {
      id: row.id,
      label: row.label,
      backgroundOpaque: Boolean(row.background_opaque),
      sources: parseJson<Scene['sources']>(row.sources_json) ?? [],
      style: parseJson<OverlayStyle>(row.style_json),
      lobbyConfig: parseJson<Scene['lobbyConfig']>(row.lobby_config_json),
      introTransition: transitions.introTransition,
      exitTransition: transitions.exitTransition,
      introTransitions: transitions.introTransitions,
      exitTransitions: transitions.exitTransitions,
      musicTrack: transitions.musicTrack,
    }
    return [row.id, scene]
  }))
}

export function saveScene(_id: string, scene: Scene): void {
  upsertScene(scene)
}

export function saveScenes(scenes: Record<string, Scene>): void {
  db.transaction(() => {
    db.exec('DELETE FROM scenes')
    for (const scene of Object.values(scenes)) upsertScene(scene)
  })()
}

export function loadApplications(): Application[] {
  const rows = db.prepare('SELECT * FROM applications ORDER BY rowid').all() as Array<{
    id: string
    label: string
    icon: string
    app_type: Application['appType']
    target_scene_id: string
    widget_source: Application['widgetSource'] | null
    widget_component: Application['widgetComponent'] | null
    icon_position_x: number | null
    icon_position_y: number | null
    icon_size: Application['iconSize'] | null
    settings_json: string | null
  }>

  return rows.map((row) => {
    const settings = parseJson<ApplicationSettingsPayload>(row.settings_json) ?? {}
    return {
      id: row.id,
      label: row.label,
      icon: row.icon,
      appType: row.app_type,
      targetSceneId: row.target_scene_id,
      widgetSource: row.widget_source ?? undefined,
      widgetComponent: row.widget_component ?? undefined,
      iconPosition: row.icon_position_x != null && row.icon_position_y != null
        ? { x: row.icon_position_x, y: row.icon_position_y }
        : undefined,
      iconSize: row.icon_size ?? undefined,
      transitionType: settings.transitionType,
      introTransition: settings.introTransition,
      exitTransition: settings.exitTransition,
      introTransitions: settings.introTransitions,
      exitTransitions: settings.exitTransitions,
      launchPipeline: settings.launchPipeline,
      gallerySettings: settings.gallerySettings,
      cameraSettings: settings.cameraSettings,
      sourceWidgetSettings: settings.sourceWidgetSettings,
      stickyNotesSettings: settings.stickyNotesSettings,
      recycleBinSettings: settings.recycleBinSettings,
      themeOverride: settings.themeOverride,
    }
  })
}

export function saveApplication(_id: string, app: Application): void {
  upsertApplication(app)
}

export function saveApplications(apps: Application[]): void {
  db.transaction(() => {
    db.exec('DELETE FROM applications')
    for (const app of apps) upsertApplication(app)
  })()
}

function loadWidgetLayouts(): WidgetLayoutDefinition[] {
  const rows = db.prepare('SELECT * FROM widget_layouts ORDER BY rowid').all() as Array<{
    id: string
    label: string
    icon: string
    source: WidgetLayoutDefinition['source']
    description: string | null
    items_json: string
    default_config_json: string | null
  }>

  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    icon: row.icon,
    source: row.source,
    description: row.description ?? undefined,
    items: parseJson<WidgetLayoutDefinition['items']>(row.items_json) ?? [],
    defaultConfig: parseJson<WidgetLayoutDefinition['defaultConfig']>(row.default_config_json),
  }))
}

function saveWidgetLayouts(layouts: WidgetLayoutDefinition[]): void {
  db.exec('DELETE FROM widget_layouts')
  for (const layout of layouts) upsertWidgetLayout(layout)
}

export function loadDesktopConfig(): DesktopConfig | undefined {
  const row = db.prepare('SELECT * FROM desktop_config WHERE id = 1').get() as {
    global_theme_json: string | null
    icon_animation: DesktopConfig['iconAnimation'] | null
    icon_arrangement: DesktopConfig['iconArrangement'] | null
    icon_motion: number | null
    icon_arrangement_motion: number | null
    default_icon_size: DesktopConfig['defaultIconSize'] | null
    auto_arrange_icons: number | null
    recycle_bin_json: string | null
    screen_saver_json: string | null
    system_sounds_json: string | null
    widget_positions_json: string | null
    widget_sizes_json: string | null
    widget_z_indices_json: string | null
    widget_default_z_indices_json: string | null
  } | undefined

  if (!row) return undefined

  return {
    globalThemeDefault: parseJson<DesktopConfig['globalThemeDefault']>(row.global_theme_json) ?? clone(DEFAULT_DESKTOP_CONFIG.globalThemeDefault),
    iconAnimation: row.icon_animation ?? DEFAULT_DESKTOP_CONFIG.iconAnimation,
    iconArrangement: row.icon_arrangement ?? DEFAULT_DESKTOP_CONFIG.iconArrangement,
    iconMotion: row.icon_motion ?? DEFAULT_DESKTOP_CONFIG.iconMotion,
    iconArrangementMotion: row.icon_arrangement_motion ?? DEFAULT_DESKTOP_CONFIG.iconArrangementMotion,
    defaultIconSize: row.default_icon_size ?? DEFAULT_DESKTOP_CONFIG.defaultIconSize,
    autoArrangeIcons: Boolean(row.auto_arrange_icons),
    recycleBin: parseJson<DesktopConfig['recycleBin']>(row.recycle_bin_json) ?? clone(DEFAULT_DESKTOP_CONFIG.recycleBin),
    screenSaver: parseJson<DesktopConfig['screenSaver']>(row.screen_saver_json) ?? clone(DEFAULT_DESKTOP_CONFIG.screenSaver),
    systemSounds: parseJson<DesktopConfig['systemSounds']>(row.system_sounds_json) ?? clone(DEFAULT_DESKTOP_CONFIG.systemSounds),
    widgetPositions: parseJson<DesktopConfig['widgetPositions']>(row.widget_positions_json),
    widgetSizes: parseJson<DesktopConfig['widgetSizes']>(row.widget_sizes_json),
    widgetZIndices: parseJson<DesktopConfig['widgetZIndices']>(row.widget_z_indices_json),
    widgetDefaultZIndices: parseJson<DesktopConfig['widgetDefaultZIndices']>(row.widget_default_z_indices_json),
    widgetLayouts: loadWidgetLayouts(),
  }
}

export function saveDesktopConfig(cfg: DesktopConfig): void {
  db.transaction(() => {
    upsertDesktopConfig(cfg)
    saveWidgetLayouts(cfg.widgetLayouts ?? [])
  })()
}

export function loadEvents(): EventConfig[] {
  const rows = db.prepare('SELECT * FROM events ORDER BY rowid').all() as Array<{
    id: string
    label: string
    icon: string
    color: string
    desc: string
    effects_json: string
    actions_json: string | null
    auto_json: string
  }>

  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    icon: row.icon,
    color: row.color,
    desc: row.desc,
    effects: parseJson<EventConfig['effects']>(row.effects_json) ?? [],
    actions: parseJson<EventConfig['actions']>(row.actions_json),
    auto: parseJson<EventConfig['auto']>(row.auto_json) ?? clone(DEFAULT_EVENT_AUTO),
  }))
}

export function saveEvent(_id: string, event: EventConfig): void {
  upsertEvent(event)
}

export function saveEvents(events: EventConfig[]): void {
  db.transaction(() => {
    db.exec('DELETE FROM events')
    for (const event of events) upsertEvent(event)
  })()
}

export function loadKeybinds(): AppConfig['keybinds'] {
  const rows = db.prepare('SELECT scope, key, action FROM keybinds').all() as Array<{
    scope: keyof AppConfig['keybinds']
    key: string
    action: string
  }>

  const keybinds: AppConfig['keybinds'] = { obs: {}, admin: {} }
  for (const row of rows) {
    if (row.scope === 'obs' || row.scope === 'admin') keybinds[row.scope][row.key] = row.action
  }
  return keybinds
}

export function saveKeybinds(keybinds: AppConfig['keybinds']): void {
  db.transaction(() => {
    db.exec('DELETE FROM keybinds')
    for (const [key, action] of Object.entries(keybinds.obs)) {
      db.prepare('INSERT INTO keybinds (scope, key, action) VALUES (?, ?, ?)').run('obs', key, action)
    }
    for (const [key, action] of Object.entries(keybinds.admin)) {
      db.prepare('INSERT INTO keybinds (scope, key, action) VALUES (?, ?, ?)').run('admin', key, action)
    }
  })()
}

export function loadObsConfig(): AppConfig['obs'] {
  const row = db.prepare('SELECT url, password FROM obs_config WHERE id = 1').get() as AppConfig['obs'] | undefined
  return row ?? clone(DEFAULT_CONFIG.obs)
}

export function saveObsConfig(cfg: AppConfig['obs']): void {
  upsertObsConfig(cfg)
}

export function loadAudioConfig(): AppConfig['audio'] {
  const row = db.prepare('SELECT master_volume, sfx_volume, music_volume FROM audio_config WHERE id = 1').get() as {
    master_volume: number
    sfx_volume: number
    music_volume: number
  } | undefined

  return row
    ? {
        masterVolume: row.master_volume,
        sfxVolume: row.sfx_volume,
        musicVolume: row.music_volume,
      }
    : clone(DEFAULT_CONFIG.audio)
}

export function saveAudioConfig(cfg: AppConfig['audio']): void {
  upsertAudioConfig(cfg)
}

export function loadOverlayStyle(): OverlayStyle {
  const row = db.prepare('SELECT * FROM overlay_style WHERE id = 1').get() as {
    background_json: string | null
    effects_json: string | null
    particles_json: string | null
    font_family: string | null
    accent_color: string | null
    text_color: string | null
  } | undefined

  if (!row) return clone(DEFAULT_CONFIG.overlayStyle)

  return {
    background: parseJson<OverlayStyle['background']>(row.background_json) ?? clone(DEFAULT_CONFIG.overlayStyle.background),
    effects: parseJson<OverlayStyle['effects']>(row.effects_json) ?? clone(DEFAULT_CONFIG.overlayStyle.effects),
    particles: parseJson<OverlayStyle['particles']>(row.particles_json) ?? clone(DEFAULT_CONFIG.overlayStyle.particles),
    fontFamily: row.font_family ?? DEFAULT_CONFIG.overlayStyle.fontFamily,
    accentColor: row.accent_color ?? DEFAULT_CONFIG.overlayStyle.accentColor,
    textColor: row.text_color ?? DEFAULT_CONFIG.overlayStyle.textColor,
  }
}

export function saveOverlayStyle(style: OverlayStyle): void {
  upsertOverlayStyle(style)
}

export function loadDesktopAmbiance(): DesktopAmbianceConfig | undefined {
  const row = db.prepare('SELECT simulation_json FROM desktop_ambiance WHERE id = 1').get() as { simulation_json: string | null } | undefined
  const widgetSimulation = parseJson<DesktopAmbianceConfig['widgetSimulation']>(row?.simulation_json)
  return widgetSimulation ? { widgetSimulation } : undefined
}

export function saveDesktopAmbiance(cfg: DesktopAmbianceConfig): void {
  upsertDesktopAmbiance(cfg)
}

export function loadSourcePresets(): SourcePreset[] {
  const rows = db.prepare('SELECT * FROM source_presets ORDER BY rowid').all() as Array<{
    id: string
    label: string
    plugin_type: string
    config_json: string
    default_position_json: string | null
  }>

  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    pluginType: row.plugin_type,
    config: parseJson<SourcePreset['config']>(row.config_json) ?? {},
    defaultPosition: parseJson<SourcePreset['defaultPosition']>(row.default_position_json),
  }))
}

export function saveSourcePreset(_id: string, preset: SourcePreset): void {
  upsertSourcePreset(preset)
}

export function saveSourcePresets(presets: SourcePreset[]): void {
  db.transaction(() => {
    db.exec('DELETE FROM source_presets')
    for (const preset of presets) upsertSourcePreset(preset)
  })()
}

export function loadMediaLibrary(): MediaEntry[] {
  const rows = db.prepare('SELECT * FROM media_library ORDER BY rowid').all() as Array<{
    id: string
    name: string
    type: MediaEntry['type']
    url: string
    duration: number | null
  }>

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    url: row.url,
    duration: row.duration ?? undefined,
  }))
}

export function saveMediaEntry(_id: string, entry: MediaEntry): void {
  upsertMediaEntry(entry)
}

export function saveMediaLibrary(entries: MediaEntry[]): void {
  db.transaction(() => {
    db.exec('DELETE FROM media_library')
    for (const entry of entries) upsertMediaEntry(entry)
  })()
}

export function loadAllConfig(): AppConfig {
  if (!hasPersistedConfig()) return clone(DEFAULT_CONFIG)

  return {
    scenes: loadScenes(),
    applications: loadApplications(),
    keybinds: loadKeybinds(),
    obs: loadObsConfig(),
    audio: loadAudioConfig(),
    overlayStyle: loadOverlayStyle(),
    desktopConfig: loadDesktopConfig() ?? clone(DEFAULT_CONFIG.desktopConfig),
    desktopAmbiance: loadDesktopAmbiance() ?? clone(DEFAULT_CONFIG.desktopAmbiance),
    events: loadEvents(),
    mediaLibrary: loadMediaLibrary(),
    sourcePresets: loadSourcePresets(),
  }
}
