/**
 * Startup behavior module.
 * Manages launch-at-startup registration and detects whether the app
 * was started via auto-launch or user action.
 *
 * Uses Electron `app.setLoginItemSettings()` for OS auto-start registration
 * and persists the preference to the SQLite `app_settings` table.
 *
 * Requirements: 14.1, 14.2, 14.3, 14.4
 */

import { app } from 'electron';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import initSqlJs from 'sql.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SimpleSqlDb {
  run(sql: string, params?: unknown[]): void;
  get(sql: string, params?: unknown[]): Record<string, unknown> | undefined;
  exec(sql: string): void;
  close(): void;
  export(): Uint8Array;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let db: SimpleSqlDb | null = null;
let currentDbPath: string = '';

// ---------------------------------------------------------------------------
// Database Helpers
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
    exec(sql: string) {
      sqlDb.run(sql);
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

/**
 * Open (or reuse) a connection to the SQLite database for app settings.
 * The `app_settings` table is expected to already exist (created by server migrations).
 */
export async function openAppSettingsDb(dbPath: string): Promise<void> {
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
 * Close the app settings database connection.
 */
export function closeAppSettingsDb(): void {
  if (db) {
    persistDb();
    db.close();
    db = null;
  }
}

// ---------------------------------------------------------------------------
// Launch Detection
// ---------------------------------------------------------------------------

/**
 * Detect whether the app was started via OS auto-launch (login item).
 *
 * On macOS/Windows: checks `app.getLoginItemSettings().wasOpenedAtLogin`.
 * On Linux (fallback): checks for `--hidden` or `--autostart` command-line args,
 * since `wasOpenedAtLogin` is not reliably supported on all Linux desktop environments.
 */
export function isAutoLaunched(): boolean {
  // Check Electron's built-in detection (works on macOS and Windows)
  const loginSettings = app.getLoginItemSettings();
  if (loginSettings.wasOpenedAtLogin) {
    return true;
  }

  // Linux fallback: check command-line arguments
  const args = process.argv.slice(1);
  return args.includes('--hidden') || args.includes('--autostart');
}

// ---------------------------------------------------------------------------
// Launch-at-Startup Registration
// ---------------------------------------------------------------------------

/**
 * Register or unregister the app to start automatically at OS login.
 *
 * Uses `app.setLoginItemSettings()` with `openAsHidden: true` so that
 * when auto-launched, the app starts minimized to tray.
 *
 * Also persists the preference to the SQLite `app_settings` table.
 */
export function setLaunchAtStartup(enabled: boolean): void {
  // Update OS login item settings
  app.setLoginItemSettings({
    openAtLogin: enabled,
    openAsHidden: true,
    // On Linux, pass --hidden arg so we can detect auto-launch
    args: enabled ? ['--hidden'] : [],
  });

  // Persist preference to database
  if (!db) return;

  db.run(
    'INSERT OR REPLACE INTO app_settings (id, launch_at_startup) VALUES (1, ?)',
    [enabled ? 1 : 0]
  );
  persistDb();
}

/**
 * Read the launch-at-startup preference from the SQLite `app_settings` table.
 * Returns false if no row exists or the database is not open.
 */
export function getLaunchAtStartup(): boolean {
  if (!db) return false;

  const row = db.get('SELECT launch_at_startup FROM app_settings WHERE id = 1');

  if (!row) return false;

  return (row.launch_at_startup as number) === 1;
}
