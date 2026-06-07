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
    sources_json TEXT NOT NULL DEFAULT '[]',
    style_json TEXT,
    lobby_config_json TEXT,
    on_entry_json TEXT NOT NULL DEFAULT '[]',
    on_exit_json TEXT NOT NULL DEFAULT '[]',
    music_track TEXT,
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

  CREATE TABLE IF NOT EXISTS source_events (
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

  CREATE TABLE IF NOT EXISTS source_presets (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    plugin_type TEXT NOT NULL,
    config_json TEXT NOT NULL DEFAULT '{}',
    default_position_json TEXT
  );

  CREATE TABLE IF NOT EXISTS source_media (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    url TEXT NOT NULL,
    duration REAL
  );

  CREATE TABLE IF NOT EXISTS source_transitions (
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
`

export function initDesktopDatabase(dbPath: string): DesktopDatabase {
  const dir = dirname(dbPath)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.exec(SCHEMA)
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
