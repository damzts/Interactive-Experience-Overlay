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
    music_volume REAL NOT NULL DEFAULT 0.7,
    ambient_track TEXT,
    ambient_volume REAL
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
    trigger_source TEXT NOT NULL DEFAULT 'kernel',
    trigger_widget_id TEXT,
    trigger_event TEXT NOT NULL,
    trigger_match_json TEXT,
    scene_is_json TEXT,
    action_kind TEXT NOT NULL,
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
  addColumn('audio_config', 'ambient_track', 'TEXT')
  addColumn('audio_config', 'ambient_volume', 'REAL')
  addColumn('twitch_config', 'client_id', 'TEXT')
  addColumn('twitch_config', 'event_reactions_json', 'TEXT')

  migrateAutomationRules(db)

  // Remove legacy bus:emit automation rules — replaced by overlay:show and desktop:notify
  try { db.exec("DELETE FROM automation_rules WHERE action_kind = 'bus:emit'") } catch { /* table may not exist yet */ }

  // Purge widget rows for component types converted to scene renderers (2026-07)
  try {
    db.exec("DELETE FROM widgets WHERE widget_component IN ('rpg-stats', 'stream-quest', 'combat-log-widget', 'retro-messenger')")
  } catch { /* table may not exist yet */ }
  return db
}

/** One-time unification of automation_rules + widget_wires into the trigger/action rule shape.
 *  Old-shape automation_rules rows become kernel-trigger rules; widget_wires rows become
 *  widget-trigger rules with a widget:action action, then the widget_wires table is dropped.
 *  Exported for tests. */
export function migrateAutomationRules(db: DesktopDatabase): void {
  const tableExists = (table: string): boolean =>
    db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table) !== undefined
  const columnExists = (table: string, column: string): boolean =>
    (db.pragma(`table_info(${table})`) as Array<{ name: string }>).some((c) => c.name === column)

  // Rebuild old-shape automation_rules (its action_kind CHECK constraint can't be altered in place)
  if (tableExists('automation_rules') && !columnExists('automation_rules', 'trigger_source')) {
    db.transaction(() => {
      db.exec(`
        CREATE TABLE automation_rules_new (
          id TEXT PRIMARY KEY,
          enabled INTEGER NOT NULL DEFAULT 1,
          trigger_source TEXT NOT NULL DEFAULT 'kernel',
          trigger_widget_id TEXT,
          trigger_event TEXT NOT NULL,
          trigger_match_json TEXT,
          scene_is_json TEXT,
          action_kind TEXT NOT NULL,
          action_params_json TEXT NOT NULL DEFAULT '{}'
        );
      `)
      db.exec(`
        INSERT INTO automation_rules_new (id, enabled, trigger_source, trigger_event, trigger_match_json, action_kind, action_params_json)
        SELECT id, enabled, 'kernel', condition_event, condition_match_json, action_kind, action_params_json FROM automation_rules;
      `)
      db.exec('DROP TABLE automation_rules;')
      db.exec('ALTER TABLE automation_rules_new RENAME TO automation_rules;')
    })()
  }

  // Import operator-created widget wires as widget-trigger rules, then retire the table
  if (tableExists('widget_wires')) {
    db.transaction(() => {
      const wires = db.prepare('SELECT * FROM widget_wires').all() as Array<{
        id: string; trigger_widget_id: string; trigger_event: string;
        target_widget_id: string; target_action: string; enabled: number;
        condition_json?: string | null;
      }>
      const insert = db.prepare(`
        INSERT OR IGNORE INTO automation_rules
          (id, enabled, trigger_source, trigger_widget_id, trigger_event, trigger_match_json, scene_is_json, action_kind, action_params_json)
        VALUES (?, ?, 'widget', ?, ?, NULL, ?, 'widget:action', ?)
      `)
      for (const w of wires) {
        let sceneIs: string | null = null
        try {
          const condition = w.condition_json ? JSON.parse(w.condition_json) as { sceneIs?: string[] } : null
          if (condition?.sceneIs?.length) sceneIs = JSON.stringify(condition.sceneIs)
        } catch { /* malformed condition — import without a scene gate */ }
        insert.run(
          `wire-${w.id}`, w.enabled, w.trigger_widget_id, w.trigger_event, sceneIs,
          JSON.stringify({ targetWidgetId: w.target_widget_id, action: w.target_action }),
        )
      }
      db.exec('DROP TABLE widget_wires;')
    })()
    console.log('[desktop-db] imported widget_wires into automation_rules')
  }
}

export function closeDesktopDatabase(db: DesktopDatabase): void {
  try {
    db.close()
    console.log('[desktop-db] Database closed.')
  } catch (e) {
    console.error('[desktop-db] Error closing database:', e)
  }
}
