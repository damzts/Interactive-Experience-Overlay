/**
 * db.ts — SQLite database setup using better-sqlite3.
 * Handles migrations inline (no external migration runner needed).
 */
import Database, { type Database as DatabaseType } from 'better-sqlite3'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
// Store DB next to the server source, at the monorepo root
const DB_PATH = join(__dirname, '../../../../ieom.db')

export const db: DatabaseType = new Database(DB_PATH)

// Enable WAL mode for better concurrent read/write performance
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// ── Schema (auto-migrated on server start) ────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS stats (
    key   TEXT PRIMARY KEY,
    value INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS archive_log (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    date   TEXT NOT NULL,
    event  TEXT NOT NULL,
    detail TEXT
  );

  CREATE TABLE IF NOT EXISTS config_store (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`)

// ── Stats queries ─────────────────────────────────────────────

/** Get all stats as a plain object { key: value } */
export function getAllStats(): Record<string, number> {
  const rows = db.prepare('SELECT key, value FROM stats').all() as { key: string; value: number }[]
  return Object.fromEntries(rows.map((r) => [r.key, r.value]))
}

/** Increment a stat by 1. Creates the key if it doesn't exist. */
export function incrementStat(key: string): number {
  db.prepare(`
    INSERT INTO stats (key, value) VALUES (?, 1)
    ON CONFLICT(key) DO UPDATE SET value = value + 1
  `).run(key)
  return (db.prepare('SELECT value FROM stats WHERE key = ?').get(key) as { value: number }).value
}

/** Reset all stats to 0 */
export function resetStats() {
  db.prepare('DELETE FROM stats').run()
}

// ── Archive log queries ───────────────────────────────────────

export interface LogEntry {
  id: number
  date: string
  event: string
  detail: string | null
}

/** Append an event to the archive log */
export function appendLog(event: string, detail?: string) {
  db.prepare('INSERT INTO archive_log (date, event, detail) VALUES (?, ?, ?)').run(
    new Date().toISOString(),
    event,
    detail ?? null,
  )
  // Keep last 1000 entries
  db.prepare('DELETE FROM archive_log WHERE id NOT IN (SELECT id FROM archive_log ORDER BY id DESC LIMIT 1000)').run()
}

/** Get most recent log entries */
export function getLog(limit = 100): LogEntry[] {
  return db.prepare('SELECT * FROM archive_log ORDER BY id DESC LIMIT ?').all(limit) as LogEntry[]
}

/** Clear archive log */
export function clearLog() {
  db.prepare('DELETE FROM archive_log').run()
}

// ── Config store queries ──────────────────────────────────────

/** Get a JSON config value by key */
export function getConfig(key: string): unknown | null {
  const row = db.prepare('SELECT value FROM config_store WHERE key = ?').get(key) as { value: string } | undefined
  return row ? JSON.parse(row.value) : null
}

/** Set a JSON config value */
export function setConfig(key: string, value: unknown) {
  db.prepare(`
    INSERT INTO config_store (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, JSON.stringify(value))
}
