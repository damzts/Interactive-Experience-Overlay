/**
 * Unit tests for desktop-db.ts — SQLite database initialization.
 *
 * Validates: Requirements 3.1, 3.3, 3.4, 3.5, 3.6
 */

import { describe, it, expect, afterEach } from 'vitest'
import { join } from 'path'
import { mkdirSync, rmSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import { initDesktopDatabase, closeDesktopDatabase } from '../desktop-db.js'
import type { Database as DatabaseType } from 'better-sqlite3'

function createTempDbPath(): string {
  const dir = join(tmpdir(), `ieom-test-${randomUUID()}`)
  mkdirSync(dir, { recursive: true })
  return join(dir, 'test.db')
}

function cleanupDb(dbPath: string, db?: DatabaseType): void {
  if (db) {
    try { closeDesktopDatabase(db) } catch { /* ignore */ }
  }
  const dir = join(dbPath, '..')
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe('initDesktopDatabase', () => {
  let dbPath: string
  let db: DatabaseType | undefined

  afterEach(() => {
    if (dbPath) cleanupDb(dbPath, db)
    db = undefined
  })

  it('should create a database file and return a database instance', () => {
    dbPath = createTempDbPath()
    db = initDesktopDatabase(dbPath)
    expect(db).toBeDefined()
    expect(existsSync(dbPath)).toBe(true)
  })

  it('should enable WAL mode (Requirement 3.4)', () => {
    dbPath = createTempDbPath()
    db = initDesktopDatabase(dbPath)
    const result = db.pragma('journal_mode') as Array<{ journal_mode: string }>
    expect(result[0].journal_mode).toBe('wal')
  })

  it('should create all expected tables', () => {
    dbPath = createTempDbPath()
    db = initDesktopDatabase(dbPath)

    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all() as Array<{ name: string }>

    const tableNames = tables.map((t) => t.name)

    // Core tables
    expect(tableNames).toContain('scenes')
    expect(tableNames).toContain('applications')
    expect(tableNames).toContain('desktop_config')
    expect(tableNames).toContain('widget_layouts')
    expect(tableNames).toContain('events')
    expect(tableNames).toContain('keybinds')
    expect(tableNames).toContain('obs_config')
    expect(tableNames).toContain('audio_config')
    expect(tableNames).toContain('overlay_style')
    expect(tableNames).toContain('desktop_ambiance')
    expect(tableNames).toContain('source_presets')
    expect(tableNames).toContain('media_library')

    // Desktop-specific tables
    expect(tableNames).toContain('license_cache')
    expect(tableNames).toContain('window_state')
    expect(tableNames).toContain('app_settings')

    // Migration tracking
    expect(tableNames).toContain('schema_migrations')
  })

  it('should seed default scenes for a new database (Requirement 3.3)', () => {
    dbPath = createTempDbPath()
    db = initDesktopDatabase(dbPath)

    const scenes = db.prepare('SELECT * FROM scenes').all() as Array<{ id: string }>
    expect(scenes.length).toBeGreaterThan(0)

    const sceneIds = scenes.map((s) => s.id)
    expect(sceneIds).toContain('LOBBY')
    expect(sceneIds).toContain('DESKTOP')
  })

  it('should seed default OBS config', () => {
    dbPath = createTempDbPath()
    db = initDesktopDatabase(dbPath)

    const obs = db.prepare('SELECT * FROM obs_config WHERE id = 1').get() as { url: string; password: string } | undefined
    expect(obs).toBeDefined()
  })

  it('should seed default audio config', () => {
    dbPath = createTempDbPath()
    db = initDesktopDatabase(dbPath)

    const audio = db.prepare('SELECT * FROM audio_config WHERE id = 1').get() as { master_volume: number } | undefined
    expect(audio).toBeDefined()
    expect(audio!.master_volume).toBe(1)
  })

  it('should seed default desktop-specific tables', () => {
    dbPath = createTempDbPath()
    db = initDesktopDatabase(dbPath)

    const license = db.prepare('SELECT * FROM license_cache WHERE id = 1').get() as { tier: string } | undefined
    expect(license).toBeDefined()
    expect(license!.tier).toBe('free')

    const windowState = db.prepare('SELECT * FROM window_state WHERE id = 1').get() as { width: number; height: number } | undefined
    expect(windowState).toBeDefined()
    expect(windowState!.width).toBe(1280)
    expect(windowState!.height).toBe(800)

    const appSettings = db.prepare('SELECT * FROM app_settings WHERE id = 1').get() as { launch_at_startup: number; auto_update_enabled: number } | undefined
    expect(appSettings).toBeDefined()
    expect(appSettings!.launch_at_startup).toBe(0)
    expect(appSettings!.auto_update_enabled).toBe(1)
  })

  it('should not re-seed an existing database', () => {
    dbPath = createTempDbPath()
    db = initDesktopDatabase(dbPath)

    // Modify a scene label
    db.prepare("UPDATE scenes SET label = 'MODIFIED' WHERE id = 'LOBBY'").run()

    // Close and re-open
    closeDesktopDatabase(db)
    db = initDesktopDatabase(dbPath)

    const lobby = db.prepare("SELECT label FROM scenes WHERE id = 'LOBBY'").get() as { label: string }
    expect(lobby.label).toBe('MODIFIED')
  })

  it('should track migrations in schema_migrations table', () => {
    dbPath = createTempDbPath()
    db = initDesktopDatabase(dbPath)

    const migrations = db.prepare('SELECT * FROM schema_migrations ORDER BY version').all() as Array<{
      version: number; name: string; applied_at: string;
    }>

    expect(migrations.length).toBe(2)
    expect(migrations[0].version).toBe(1)
    expect(migrations[0].name).toBe('create_core_tables')
    expect(migrations[1].version).toBe(2)
    expect(migrations[1].name).toBe('create_desktop_specific_tables')
  })

  it('should not have user_id columns in any table (Requirement 3.5)', () => {
    dbPath = createTempDbPath()
    db = initDesktopDatabase(dbPath)

    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    ).all() as Array<{ name: string }>

    for (const table of tables) {
      const columns = db.prepare(`PRAGMA table_info("${table.name}")`).all() as Array<{ name: string }>
      const columnNames = columns.map((c) => c.name)
      expect(columnNames).not.toContain('user_id')
    }
  })

  it('should throw on invalid database path', () => {
    dbPath = '/nonexistent/path/that/cannot/be/created/test.db'
    expect(() => initDesktopDatabase(dbPath)).toThrow()
  })
})
