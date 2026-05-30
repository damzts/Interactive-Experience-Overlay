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

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import initSqlJs from 'sql.js';

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

interface SimpleSqlDb {
  run(sql: string, params?: unknown[]): void;
  get(sql: string, params?: unknown[]): Record<string, unknown> | undefined;
  close(): void;
  export(): Uint8Array;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let db: SimpleSqlDb | null = null;
let currentDbPath: string = '';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function wrapSqlJs(sqlDb: any): SimpleSqlDb {
  return {
    run(sql: string, params?: unknown[]) {
      sqlDb.run(sql, params);
    },
    get(sql: string, params?: unknown[]): Record<string, unknown> | undefined {
      const stmt = sqlDb.prepare(sql);
      if (params) stmt.bind(params);
      if (stmt.step()) {
        const cols = stmt.getColumnNames();
        const values = stmt.get();
        const row: Record<string, unknown> = {};
        cols.forEach((col: string, i: number) => { row[col] = values[i]; });
        stmt.free();
        return row;
      }
      stmt.free();
      return undefined;
    },
    close() {
      sqlDb.close();
    },
    export() {
      return sqlDb.export();
    },
  };
}

function persistDb(): void {
  if (!db) return;
  const data = db.export();
  writeFileSync(currentDbPath, Buffer.from(data));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Open (or reuse) a connection to the SQLite database for window state.
 * The `window_state` table is expected to already exist (created by server migrations).
 */
export async function openWindowStateDb(dbPath: string): Promise<void> {
  if (db) return;
  currentDbPath = dbPath;

  const SQL = await initSqlJs();

  if (existsSync(dbPath)) {
    const buffer = readFileSync(dbPath);
    const sqlDb = new SQL.Database(buffer);
    db = wrapSqlJs(sqlDb);
  } else {
    const sqlDb = new SQL.Database();
    db = wrapSqlJs(sqlDb);
  }
}

/**
 * Close the window state database connection.
 */
export function closeWindowStateDb(): void {
  if (db) {
    persistDb();
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

  const row = db.get('SELECT x, y, width, height, is_maximized FROM window_state WHERE id = 1');

  if (!row) return null;

  return {
    x: row.x as number | null,
    y: row.y as number | null,
    width: row.width as number,
    height: row.height as number,
    isMaximized: (row.is_maximized as number) === 1,
  };
}

/**
 * Persist window bounds to the `window_state` table.
 */
export function saveWindowBounds(bounds: WindowBounds): void {
  if (!db) return;

  db.run(
    'INSERT OR REPLACE INTO window_state (id, x, y, width, height, is_maximized) VALUES (1, ?, ?, ?, ?, ?)',
    [bounds.x, bounds.y, bounds.width, bounds.height, bounds.isMaximized ? 1 : 0]
  );
  persistDb();
}
