/**
 * Desktop-mode SQLite database initialization using better-sqlite3.
 * Synchronous, native, WAL mode. No WASM, no full-file-rewrite on every write.
 */

import Database from 'better-sqlite3'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import logger from '../lib/logger.js';


export type DesktopDatabase = Database.Database

// ── Migrations ───────────────────────────────────────────────────

interface Migration {
  version: number
  name: string
  up: (db: DesktopDatabase) => void
}

const migrations: Migration[] = [
  {
    version: 1,
    name: 'create_core_tables',
    up: (db) => {
      db.exec(`
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

        -- Layout header (one row per layout)
        CREATE TABLE IF NOT EXISTS widget_layouts (
          id TEXT PRIMARY KEY,
          label TEXT NOT NULL,
          icon TEXT NOT NULL DEFAULT '',
          source TEXT NOT NULL DEFAULT 'user',
          description TEXT,
          sort_order INTEGER NOT NULL DEFAULT 0
        );

        -- Layout items (one row per widget per layout)
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

        CREATE TABLE IF NOT EXISTS events (
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
      `)
    },
  },
  {
    version: 2,
    name: 'create_desktop_specific_tables',
    up: (db) => {
      db.exec(`
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
      `)
    },
  },
  {
    version: 3,
    name: 'create_users_table',
    up: (db) => {
      db.exec(`
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
      `)
    },
  },
  {
    version: 4,
    name: 'rename_source_tables_add_geometry_transitions',
    up: (db) => {
      db.exec(`
        ALTER TABLE media_library RENAME TO source_media;
        ALTER TABLE events RENAME TO source_events;
        CREATE TABLE IF NOT EXISTS source_transitions (
          id TEXT PRIMARY KEY,
          label TEXT NOT NULL,
          type TEXT NOT NULL,
          params_json TEXT NOT NULL DEFAULT '{}'
        );
        ALTER TABLE applications ADD COLUMN window_x REAL;
        ALTER TABLE applications ADD COLUMN window_y REAL;
        ALTER TABLE applications ADD COLUMN window_width REAL;
        ALTER TABLE applications ADD COLUMN window_height REAL;
        ALTER TABLE applications ADD COLUMN z_index_default INTEGER;
        ALTER TABLE applications ADD COLUMN z_index_current INTEGER;
        ALTER TABLE scenes ADD COLUMN on_entry_json TEXT NOT NULL DEFAULT '[]';
        ALTER TABLE scenes ADD COLUMN on_exit_json TEXT NOT NULL DEFAULT '[]';
        ALTER TABLE scenes ADD COLUMN music_track TEXT;
        DROP TABLE IF EXISTS overlay_style;
      `)
    },
  },
  {
    version: 5,
    name: 'ensure_all_core_tables_and_columns',
    up: (db) => {
      // Ensure tables that may be missing from pre-migration databases
      db.exec(`
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

        CREATE TABLE IF NOT EXISTS source_presets (
          id TEXT PRIMARY KEY,
          label TEXT NOT NULL,
          plugin_type TEXT NOT NULL,
          config_json TEXT NOT NULL DEFAULT '{}',
          default_position_json TEXT
        );

        CREATE TABLE IF NOT EXISTS source_transitions (
          id TEXT PRIMARY KEY,
          label TEXT NOT NULL,
          type TEXT NOT NULL,
          params_json TEXT NOT NULL DEFAULT '{}'
        );
      `)

      // Ensure sort_order column on widget_layouts if table existed without it
      const cols = db.prepare("PRAGMA table_info(widget_layouts)").all() as { name: string }[]
      if (!cols.some(c => c.name === 'sort_order')) {
        db.exec("ALTER TABLE widget_layouts ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0")
      }
    },
  },
]

function runMigrations(db: DesktopDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  const currentVersion = (db.prepare(
    'SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations'
  ).get() as { version: number }).version

  const pending = migrations.filter((m) => m.version > currentVersion)
  if (pending.length === 0) return

  for (const migration of pending) {
    logger.info({ version: migration.version, name: migration.name }, 'Applying migration')    db.transaction(() => {
      migration.up(db)
      db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)').run(migration.version, migration.name)
    })()
    logger.info({ version: migration.version }, 'Migration applied')  }
}

// ── Public API ───────────────────────────────────────────────────

export function initDesktopDatabase(dbPath: string): DesktopDatabase {
  const dir = dirname(dbPath)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  runMigrations(db)
  return db
}

export function closeDesktopDatabase(db: DesktopDatabase): void {
  try {
    db.close()
    logger.info('[desktop-db] Database closed.')
  } catch (e) {
    logger.error({ err }, '[desktop-db] Error closing database:')
  }
}
