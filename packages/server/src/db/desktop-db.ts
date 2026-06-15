/**
 * Desktop-mode SQLite database initialization.
 * No migration system — schema is applied directly on init.
 * Assumes a fresh DB file for each development iteration.
 */

import Database from 'better-sqlite3'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

export type DesktopDatabase = Database.Database

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS scenes (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    background_opaque INTEGER NOT NULL DEFAULT 0,
    windows_json TEXT NOT NULL DEFAULT '[]',
    style_json TEXT,
    lobby_config_json TEXT,
    on_entry_json TEXT NOT NULL DEFAULT '[]',
    on_exit_json TEXT NOT NULL DEFAULT '[]',
    music_track TEXT,
    ambient_track TEXT,
    show_desktop INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS widgets (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT '',
    widget_source TEXT,
    widget_component TEXT,
    window_x REAL,
    window_y REAL,
    window_width REAL,
    window_height REAL,
    z_index_default INTEGER,
    z_index_current INTEGER,
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
    system_sounds_json TEXT
  );

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

  CREATE TABLE IF NOT EXISTS media_effects (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT '',
    color TEXT NOT NULL DEFAULT '',
    "desc" TEXT NOT NULL DEFAULT '',
    effects_json TEXT NOT NULL DEFAULT '[]',
    actions_json TEXT,
    auto_json TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS keybinds (
    scope TEXT NOT NULL,
    key TEXT NOT NULL,
    action TEXT NOT NULL,
    PRIMARY KEY (scope, key)
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

  CREATE TABLE IF NOT EXISTS desktop_ambiance (
    id INTEGER PRIMARY KEY DEFAULT 1,
    simulation_json TEXT
  );

  CREATE TABLE IF NOT EXISTS media_renders (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    renderer_type TEXT NOT NULL,
    config_json TEXT NOT NULL DEFAULT '{}',
    default_position_json TEXT
  );

  CREATE TABLE IF NOT EXISTS media_gallery (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    url TEXT NOT NULL,
    duration REAL
  );

  CREATE TABLE IF NOT EXISTS widget_wires (
    id TEXT PRIMARY KEY,
    trigger_widget_id TEXT NOT NULL,
    trigger_event TEXT NOT NULL,
    target_widget_id TEXT NOT NULL,
    target_action TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    condition_json TEXT
  );

  CREATE TABLE IF NOT EXISTS media_transitions (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    type TEXT NOT NULL,
    params_json TEXT NOT NULL DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS license_cache (
    id INTEGER PRIMARY KEY DEFAULT 1,
    tier TEXT NOT NULL DEFAULT 'free',
    last_validated_at TEXT,
    token_hash TEXT
  );

  CREATE TABLE IF NOT EXISTS window_state (
    id INTEGER PRIMARY KEY DEFAULT 1,
    x INTEGER,
    y INTEGER,
    width INTEGER NOT NULL DEFAULT 1280,
    height INTEGER NOT NULL DEFAULT 800,
    is_maximized INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    launch_at_startup INTEGER NOT NULL DEFAULT 0,
    auto_update_enabled INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    google_id TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    slug TEXT NOT NULL UNIQUE,
    refresh_token_hash TEXT,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
  );

  CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
  CREATE INDEX IF NOT EXISTS idx_users_slug ON users(slug);

  CREATE TABLE IF NOT EXISTS automation_rules (
    id TEXT PRIMARY KEY,
    enabled INTEGER NOT NULL DEFAULT 1,
    condition_event TEXT NOT NULL,
    condition_match_json TEXT,
    action_kind TEXT NOT NULL CHECK(action_kind IN ('widget:toggle','scene:change','overlay:show','desktop:notify')),
    action_params_json TEXT NOT NULL DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS shows (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL DEFAULT '',
    steps_json TEXT NOT NULL DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS twitch_config (
    id INTEGER PRIMARY KEY DEFAULT 1,
    channel TEXT NOT NULL DEFAULT '',
    access_token TEXT,
    enabled INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS chat_reactions (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL DEFAULT '',
    enabled INTEGER NOT NULL DEFAULT 1,
    match_json TEXT NOT NULL DEFAULT '{}',
    actions_json TEXT,
    effects_json TEXT,
    cooldown_ms INTEGER NOT NULL DEFAULT 0
  );
`

export function initDesktopDatabase(dbPath: string): DesktopDatabase {
  const dir = dirname(dbPath)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.exec(SCHEMA)

  // Column migrations — idempotent ALTER TABLE guards for columns added after initial schema
  const addColumn = (table: string, column: string, def: string) => {
    try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`) } catch { /* already exists */ }
  }
  addColumn('scenes', 'ambient_track', 'TEXT')
  addColumn('widget_wires', 'condition_json', 'TEXT')

  // sources → renderer rename: migrate scenes.sources_json → windows_json
  const sceneColumns = (db.prepare("PRAGMA table_info(scenes)").all() as Array<{ name: string }>).map((c) => c.name)
  if (sceneColumns.includes('sources_json') && !sceneColumns.includes('windows_json')) {
    db.exec('ALTER TABLE scenes RENAME COLUMN sources_json TO windows_json')
  }

  // sources → renderer rename: migrate source_presets table → window_presets
  const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>).map((t) => t.name)
  if (tables.includes('source_presets') && !tables.includes('window_presets')) {
    db.exec('ALTER TABLE source_presets RENAME TO window_presets')
    const presetColumns = (db.prepare("PRAGMA table_info(window_presets)").all() as Array<{ name: string }>).map((c) => c.name)
    if (presetColumns.includes('plugin_type') && !presetColumns.includes('renderer_type')) {
      db.exec('ALTER TABLE window_presets RENAME COLUMN plugin_type TO renderer_type')
    }
  }

  // asset-library → media-library rename: migrate legacy table names
  const tableNames = (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>).map((t) => t.name)
  if (tableNames.includes('source_events')     && !tableNames.includes('media_effects'))     db.exec('ALTER TABLE source_events RENAME TO media_effects')
  if (tableNames.includes('source_media')      && !tableNames.includes('media_gallery'))     db.exec('ALTER TABLE source_media RENAME TO media_gallery')
  if (tableNames.includes('window_presets')    && !tableNames.includes('media_renders'))     db.exec('ALTER TABLE window_presets RENAME TO media_renders')
  if (tableNames.includes('source_transitions') && !tableNames.includes('media_transitions')) db.exec('ALTER TABLE source_transitions RENAME TO media_transitions')

  // Remove legacy bus:emit automation rules — replaced by overlay:show and desktop:notify
  try { db.exec("DELETE FROM automation_rules WHERE action_kind = 'bus:emit'") } catch { /* table may not exist yet */ }
  return db
}

export function closeDesktopDatabase(db: DesktopDatabase): void {
  try {
    db.close()
    console.log('[desktop-db] Database closed.')
  } catch (e) {
    console.error('[desktop-db] Error closing database:', e)
  }
}
