/**
 * Desktop-mode SQLite database initialization.
 *
 * Provides a single-tenant SQLite database using sql.js (WebAssembly SQLite).
 * No user_id scoping — all queries operate on a single tenant.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7
 */

import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DEFAULT_CONFIG } from '@ieom/shared'
import type { AppConfig } from '@ieom/shared'

// ── Wrapper to provide better-sqlite3-like API over sql.js ───────

/**
 * A synchronous wrapper around sql.js Database that provides
 * a better-sqlite3-compatible interface for the rest of the codebase.
 */
export class DesktopDatabase {
  private db: SqlJsDatabase
  private dbPath: string
  private dirty = false

  constructor(db: SqlJsDatabase, dbPath: string) {
    this.db = db
    this.dbPath = dbPath
  }

  /** Execute raw SQL (no return value). */
  exec(sql: string): void {
    this.db.run(sql)
    this.dirty = true
  }

  /** Prepare a statement and return a wrapper with run/get/all methods. */
  prepare(sql: string): PreparedStatement {
    return new PreparedStatement(this, this.db, sql)
  }

  /**
   * Query helper compatible with pg Pool.
   * Supports SELECT/INSERT/UPDATE ... RETURNING * patterns used by the auth repository.
   */
  async query(sql: string, params: unknown[] = []): Promise<{ rows: Array<Record<string, unknown>> }> {
    const stmt = this.db.prepare(sql)
    stmt.bind(params as any[])

    const rows: Array<Record<string, unknown>> = []
    while (stmt.step()) {
      const cols = stmt.getColumnNames()
      const values = stmt.get()
      const row: Record<string, unknown> = {}
      cols.forEach((col, i) => {
        row[col] = values[i]
      })
      rows.push(row)
    }

    stmt.free()

    if (!/^\s*SELECT/i.test(sql)) {
      this.markDirty()
      this.persist()
    }

    return { rows }
  }

  /** Execute a pragma and return the result. */
  pragma(pragmaStr: string): unknown {
    const results = this.db.exec(`PRAGMA ${pragmaStr}`)
    if (results.length === 0) return []
    const cols = results[0].columns
    return results[0].values.map((row) => {
      const obj: Record<string, unknown> = {}
      cols.forEach((col, i) => { obj[col] = row[i] })
      return obj
    })
  }

  /** Run a function inside a transaction. Returns a callable. */
  transaction<T extends (...args: unknown[]) => unknown>(fn: T): T {
    const self = this
    const wrapped = function (this: unknown, ...args: unknown[]) {
      self.db.run('BEGIN TRANSACTION')
      try {
        const result = fn.apply(this, args)
        self.db.run('COMMIT')
        self.dirty = true
        self.persist()
        return result
      } catch (e) {
        self.db.run('ROLLBACK')
        throw e
      }
    } as unknown as T
    return wrapped
  }

  /** Persist the database to disk. */
  persist(): void {
    if (!this.dirty) return
    const data = this.db.export()
    const buffer = Buffer.from(data)
    writeFileSync(this.dbPath, buffer)
    this.dirty = false
  }

  /** Mark as dirty (called by PreparedStatement on writes). */
  markDirty(): void {
    this.dirty = true
  }

  /** Close the database. */
  close(): void {
    this.persist()
    this.db.close()
  }

  /** Get the underlying sql.js database (for advanced use). */
  getInternalDb(): SqlJsDatabase {
    return this.db
  }
}

class PreparedStatement {
  constructor(
    private wrapper: DesktopDatabase,
    private db: SqlJsDatabase,
    private sql: string,
  ) {}

  /** Run the statement (INSERT/UPDATE/DELETE). */
  run(...params: unknown[]): { changes: number } {
    const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params
    this.db.run(this.sql, flatParams as any[])
    this.wrapper.markDirty()
    return { changes: this.db.getRowsModified() }
  }

  /** Get a single row. */
  get(...params: unknown[]): unknown {
    const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params
    const stmt = this.db.prepare(this.sql)
    stmt.bind(flatParams as any[])
    if (stmt.step()) {
      const cols = stmt.getColumnNames()
      const values = stmt.get()
      const row: Record<string, unknown> = {}
      cols.forEach((col, i) => { row[col] = values[i] })
      stmt.free()
      return row
    }
    stmt.free()
    return undefined
  }

  /** Get all rows. */
  all(...params: unknown[]): unknown[] {
    const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params
    const results = this.db.exec(this.sql, flatParams as any[])
    if (results.length === 0) return []
    const cols = results[0].columns
    return results[0].values.map((row) => {
      const obj: Record<string, unknown> = {}
      cols.forEach((col, i) => { obj[col] = row[i] })
      return obj
    })
  }
}

// ── Types ────────────────────────────────────────────────────────

export interface DesktopMigration {
  version: number
  name: string
  up: (db: DesktopDatabase) => void
}

// ── Migrations ───────────────────────────────────────────────────

const migrations: DesktopMigration[] = [
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
    version: 2,
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
]

// ── Migration Runner ─────────────────────────────────────────────

function ensureMigrationsTable(db: DesktopDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
}

function getCurrentVersion(db: DesktopDatabase): number {
  const row = db.prepare(
    'SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations'
  ).get() as { version: number } | undefined
  return row?.version ?? 0
}

function runMigrations(db: DesktopDatabase): void {
  ensureMigrationsTable(db)

  const currentVersion = getCurrentVersion(db)
  const pending = migrations.filter((m) => m.version > currentVersion)

  if (pending.length === 0) {
    console.log('[desktop-db] Database schema is up to date.')
    return
  }

  console.log(
    `[desktop-db] Current version: ${currentVersion}. Applying ${pending.length} pending migration(s)...`
  )

  for (const migration of pending) {
    try {
      console.log(`[desktop-db] Applying migration ${migration.version}: ${migration.name}...`)
      migration.up(db)
      db.prepare(
        'INSERT INTO schema_migrations (version, name) VALUES (?, ?)'
      ).run(migration.version, migration.name)
      console.log(`[desktop-db] Migration ${migration.version} applied successfully.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(
        `[desktop-db] Migration ${migration.version} (${migration.name}) failed: ${message}`
      )
    }
  }

  db.persist()
  console.log('[desktop-db] All migrations applied successfully.')
}

// ── Seeding ──────────────────────────────────────────────────────

function seedDefaultConfig(db: DesktopDatabase): void {
  const row = db.prepare('SELECT COUNT(*) AS count FROM scenes').get() as { count: number }
  if (row.count > 0) {
    console.log('[desktop-db] Database already has data, skipping seed.')
    return
  }

  console.log('[desktop-db] Seeding default configuration...')

  const config = DEFAULT_CONFIG as unknown as AppConfig

  // Seed scenes
  for (const scene of Object.values(config.scenes)) {
    db.prepare(`
      INSERT INTO scenes (id, label, background_opaque, sources_json, style_json, lobby_config_json, transitions_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      scene.id,
      scene.label,
      scene.backgroundOpaque ? 1 : 0,
      JSON.stringify(scene.sources ?? []),
      scene.style ? JSON.stringify(scene.style) : null,
      scene.lobbyConfig ? JSON.stringify(scene.lobbyConfig) : null,
      JSON.stringify({
        introTransition: scene.introTransition,
        exitTransition: scene.exitTransition,
        introTransitions: scene.introTransitions,
        exitTransitions: scene.exitTransitions,
        musicTrack: scene.musicTrack,
      })
    )
  }

  // Seed applications
  if (config.applications && config.applications.length > 0) {
    for (const app of config.applications) {
      db.prepare(`
        INSERT INTO applications (id, label, icon, app_type, target_scene_id, widget_source, widget_component, icon_position_x, icon_position_y, icon_size, settings_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
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
        app.gallerySettings ? JSON.stringify(app.gallerySettings) : null
      )
    }
  }

  // Seed OBS config
  db.prepare(`
    INSERT OR REPLACE INTO obs_config (id, url, password) VALUES (1, ?, ?)
  `).run(config.obs.url, config.obs.password)

  // Seed audio config
  db.prepare(`
    INSERT OR REPLACE INTO audio_config (id, master_volume, sfx_volume, music_volume) VALUES (1, ?, ?, ?)
  `).run(config.audio.masterVolume, config.audio.sfxVolume, config.audio.musicVolume)

  // Seed overlay style
  if (config.overlayStyle) {
    const style = config.overlayStyle
    db.prepare(`
      INSERT OR REPLACE INTO overlay_style (id, background_json, effects_json, particles_json, font_family, accent_color, text_color)
      VALUES (1, ?, ?, ?, ?, ?, ?)
    `).run(
      style.background ? JSON.stringify(style.background) : null,
      style.effects ? JSON.stringify(style.effects) : null,
      style.particles ? JSON.stringify(style.particles) : null,
      style.fontFamily ?? null,
      style.accentColor ?? null,
      style.textColor ?? null
    )
  }

  // Seed keybinds
  if (config.keybinds) {
    for (const [key, action] of Object.entries(config.keybinds.obs ?? {})) {
      db.prepare('INSERT OR REPLACE INTO keybinds (scope, key, action) VALUES (?, ?, ?)').run('obs', key, action)
    }
    for (const [key, action] of Object.entries(config.keybinds.admin ?? {})) {
      db.prepare('INSERT OR REPLACE INTO keybinds (scope, key, action) VALUES (?, ?, ?)').run('admin', key, action)
    }
  }

  // Seed desktop ambiance
  if (config.desktopAmbiance) {
    db.prepare(`
      INSERT OR REPLACE INTO desktop_ambiance (id, simulation_json) VALUES (1, ?)
    `).run(JSON.stringify(config.desktopAmbiance))
  }

  // Seed events
  if (config.events && config.events.length > 0) {
    for (const event of config.events) {
      db.prepare(`
        INSERT INTO events (id, label, icon, color, "desc", effects_json, actions_json, auto_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        event.id,
        event.label,
        event.icon ?? '',
        event.color ?? '',
        event.desc ?? '',
        JSON.stringify(event.effects ?? []),
        event.actions ? JSON.stringify(event.actions) : null,
        JSON.stringify(event.auto ?? { enabled: false, intervalMs: 0 })
      )
    }
  }

  // Seed source presets
  if (config.sourcePresets && config.sourcePresets.length > 0) {
    for (const preset of config.sourcePresets) {
      db.prepare(`
        INSERT INTO source_presets (id, label, plugin_type, config_json, default_position_json)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        preset.id,
        preset.label,
        preset.pluginType,
        JSON.stringify(preset.config ?? {}),
        preset.defaultPosition ? JSON.stringify(preset.defaultPosition) : null
      )
    }
  }

  // Seed media library
  if (config.mediaLibrary && config.mediaLibrary.length > 0) {
    for (const entry of config.mediaLibrary) {
      db.prepare(`
        INSERT INTO media_library (id, name, type, url, duration) VALUES (?, ?, ?, ?, ?)
      `).run(entry.id, entry.name, entry.type, entry.url, entry.duration ?? null)
    }
  }

  // Seed desktop-specific tables with defaults
  db.prepare(`
    INSERT OR REPLACE INTO license_cache (id, tier, last_validated_at, token_hash)
    VALUES (1, 'free', NULL, NULL)
  `).run()

  db.prepare(`
    INSERT OR REPLACE INTO window_state (id, x, y, width, height, is_maximized)
    VALUES (1, NULL, NULL, 1280, 800, 0)
  `).run()

  db.prepare(`
    INSERT OR REPLACE INTO app_settings (id, launch_at_startup, auto_update_enabled)
    VALUES (1, 0, 1)
  `).run()

  db.persist()
  console.log('[desktop-db] Default configuration seeded successfully.')
}

// ── Public API ───────────────────────────────────────────────────

/**
 * Initialize the desktop SQLite database (async due to sql.js WASM loading).
 *
 * Opens a sql.js database at the given path, runs migrations, and seeds
 * default configuration for new databases.
 *
 * @param dbPath - Full path to the SQLite database file
 * @returns The initialized database instance
 * @throws Error if the database cannot be opened or a migration fails
 */
export async function initDesktopDatabase(dbPath: string): Promise<DesktopDatabase> {
  // Ensure directory exists
  const dir = dirname(dbPath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  // Initialize sql.js
  const SQL = await initSqlJs()

  let db: DesktopDatabase

  try {
    if (existsSync(dbPath)) {
      const fileBuffer = readFileSync(dbPath)
      const sqlDb = new SQL.Database(fileBuffer)
      db = new DesktopDatabase(sqlDb, dbPath)
    } else {
      const sqlDb = new SQL.Database()
      db = new DesktopDatabase(sqlDb, dbPath)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`[desktop-db] Failed to open database at ${dbPath}: ${message}`)
  }

  // Enable WAL mode (note: sql.js doesn't truly support WAL but we set it for compatibility)
  try {
    db.pragma('journal_mode = WAL')
  } catch {
    // sql.js may not support WAL — that's fine for desktop single-process use
  }

  // Enable foreign keys
  db.exec('PRAGMA foreign_keys = ON')

  // Run migrations
  runMigrations(db)

  // Seed default config for new databases
  seedDefaultConfig(db)

  return db
}

/**
 * Close the desktop database gracefully.
 */
export function closeDesktopDatabase(db: DesktopDatabase): void {
  try {
    db.close()
    console.log('[desktop-db] Database closed.')
  } catch (error) {
    console.error('[desktop-db] Error closing database:', error)
  }
}
