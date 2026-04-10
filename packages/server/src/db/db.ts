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
  CREATE TABLE IF NOT EXISTS config_store (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`)

// ── Config store queries ──────────────────────────────────────

/** Get a JSON config value by key */
export function getConfig(key: string): unknown | null {
  const row = db.prepare('SELECT value FROM config_store WHERE key = ?').get(key) as { value: string } | undefined
  return row ? JSON.parse(row.value) : null
}

/** Get multiple JSON config values in a single query. Returns only keys that exist. */
export function getConfigMany(keys: string[]): Record<string, unknown> {
  if (keys.length === 0) return {}
  const placeholders = keys.map(() => '?').join(', ')
  const rows = db.prepare(`SELECT key, value FROM config_store WHERE key IN (${placeholders})`).all(...keys) as { key: string; value: string }[]
  return Object.fromEntries(rows.map((r) => [r.key, JSON.parse(r.value)]))
}

/** Set a JSON config value */
export function setConfig(key: string, value: unknown) {
  db.prepare(`
    INSERT INTO config_store (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, JSON.stringify(value))
}
