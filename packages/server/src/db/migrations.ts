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
import { db } from './connection.js'
import { boolToInt } from './utils.js'

type SceneTransitionsPayload = Pick<Scene, 'introTransition' | 'exitTransition' | 'introTransitions' | 'exitTransitions' | 'musicTrack'>
type ApplicationSettingsPayload = Pick<Application, 'transitionType' | 'introTransition' | 'exitTransition' | 'introTransitions' | 'exitTransitions' | 'launchPipeline' | 'gallerySettings' | 'cameraSettings' | 'sourceWidgetSettings' | 'stickyNotesSettings' | 'recycleBinSettings' | 'themeOverride'>

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

export function runMigrations(): void {
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

export function hasPersistedConfig(): boolean {
  return (db.pragma('user_version', { simple: true }) as number) >= 1
}

runMigrations()
