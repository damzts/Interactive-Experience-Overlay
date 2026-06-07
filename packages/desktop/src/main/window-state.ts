/**
 * Window state persistence helper.
 * Reads and writes Admin Window bounds to the SQLite `window_state` table.
 *
 * Opens a separate read/write connection to the same database file used by
 * the embedded server. This avoids coupling the window manager to the server
 * lifecycle while sharing the same persisted state.
 *
 * Requirements: 13.3, 13.4
 */

import Database from 'better-sqlite3';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WindowBounds {
  x: number | null;
  y: number | null;
  width: number;
  height: number;
  isMaximized: boolean;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let db: Database.Database | null = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Open (or reuse) a connection to the SQLite database for window state.
 * The `window_state` table is expected to already exist (created by server migrations).
 */
export function openWindowStateDb(dbPath: string): void {
  if (db) return;
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
}

/**
 * Close the window state database connection.
 */
export function closeWindowStateDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Load persisted window bounds from the `window_state` table.
 * Returns null if no row exists or the database is not open.
 */
export function loadWindowBounds(): WindowBounds | null {
  if (!db) return null;

  const row = db.prepare('SELECT x, y, width, height, is_maximized FROM window_state WHERE id = 1').get() as
    | { x: number | null; y: number | null; width: number; height: number; is_maximized: number }
    | undefined;

  if (!row) return null;

  return {
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    isMaximized: row.is_maximized === 1,
  };
}

/**
 * Persist window bounds to the `window_state` table.
 */
export function saveWindowBounds(bounds: WindowBounds): void {
  if (!db) return;

  db.prepare(
    'INSERT OR REPLACE INTO window_state (id, x, y, width, height, is_maximized) VALUES (1, ?, ?, ?, ?, ?)'
  ).run(bounds.x, bounds.y, bounds.width, bounds.height, bounds.isMaximized ? 1 : 0);
}
