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
import Database from 'better-sqlite3';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let db: Database.Database | null = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Open (or reuse) a connection to the SQLite database for app settings.
 * The `app_settings` table is expected to already exist (created by server migrations).
 */
export function openAppSettingsDb(dbPath: string): void {
  if (db) return;
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
}

/**
 * Close the app settings database connection.
 */
export function closeAppSettingsDb(): void {
  if (db) {
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
  app.setLoginItemSettings({
    openAtLogin: enabled,
    openAsHidden: true,
    args: enabled ? ['--hidden'] : [],
  });

  if (!db) return;
  db.prepare('INSERT OR REPLACE INTO app_settings (id, launch_at_startup) VALUES (1, ?)').run(enabled ? 1 : 0);
}

/**
 * Read the launch-at-startup preference from the SQLite `app_settings` table.
 * Returns false if no row exists or the database is not open.
 */
export function getLaunchAtStartup(): boolean {
  if (!db) return false;
  const row = db.prepare('SELECT launch_at_startup FROM app_settings WHERE id = 1').get() as { launch_at_startup: number } | undefined;
  return row?.launch_at_startup === 1;
}
