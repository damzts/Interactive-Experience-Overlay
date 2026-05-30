/**
 * License validation service.
 * Validates the user's license tier against the Remote Web App
 * and manages grace period / caching logic.
 *
 * Opens a separate connection to the same SQLite database used by the
 * embedded server to read/write the `license_cache` table.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 12.4, 12.5
 */

import { app, BrowserWindow, Notification } from 'electron';
import { join } from 'node:path';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import initSqlJs from 'sql.js';
import { loadToken, clearToken } from './token-storage.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LicenseTier = 'free' | 'pro' | 'pro+rooms';

interface LicenseCacheRow {
  id: number;
  tier: string;
  last_validated_at: string | null;
  token_hash: string | null;
}

interface SimpleSqlDb {
  run(sql: string, params?: unknown[]): void;
  get(sql: string, params?: unknown[]): Record<string, unknown> | undefined;
  exec(sql: string): void;
  close(): void;
  export(): Uint8Array;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REMOTE_BASE_URL = process.env.IEOM_REMOTE_URL || 'https://app.ieom.gg';
const REQUEST_TIMEOUT_MS = 10_000;
const REVALIDATION_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const CONNECTIVITY_REVALIDATION_DELAY_MS = 30_000; // 30 seconds

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let db: SimpleSqlDb | null = null;
let dbPath: string = '';
let currentTier: LicenseTier = 'free';
let revalidationTimer: ReturnType<typeof setInterval> | null = null;
let connectivityTimer: ReturnType<typeof setTimeout> | null = null;
let isOnline = true;

// ---------------------------------------------------------------------------
// Database helpers
// ---------------------------------------------------------------------------

/**
 * Open (or reuse) a connection to the SQLite database for license cache.
 */
async function openLicenseDb(): Promise<void> {
  if (db) return;
  dbPath = join(app.getPath('userData'), 'ieom.db');

  const SQL = await initSqlJs();

  if (existsSync(dbPath)) {
    const buffer = readFileSync(dbPath);
    const sqlDb = new SQL.Database(buffer);
    db = wrapSqlJs(sqlDb);
  } else {
    const sqlDb = new SQL.Database();
    db = wrapSqlJs(sqlDb);
  }

  // Ensure the license_cache table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS license_cache (
      id INTEGER PRIMARY KEY DEFAULT 1,
      tier TEXT NOT NULL DEFAULT 'free',
      last_validated_at TEXT,
      token_hash TEXT
    )
  `);
  persistDb();
}

function wrapSqlJs(sqlDb: InstanceType<Awaited<ReturnType<typeof initSqlJs>>['Database']>): SimpleSqlDb {
  return {
    run(sql: string, params?: unknown[]) {
      sqlDb.run(sql, params as any[]);
    },
    get(sql: string, params?: unknown[]): Record<string, unknown> | undefined {
      const stmt = sqlDb.prepare(sql);
      if (params) stmt.bind(params as any[]);
      if (stmt.step()) {
        const cols = stmt.getColumnNames();
        const values = stmt.get();
        const row: Record<string, unknown> = {};
        cols.forEach((col, i) => { row[col] = values[i]; });
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
  writeFileSync(dbPath, Buffer.from(data));
}

/**
 * Read the cached license data from the database.
 */
function readCache(): LicenseCacheRow | null {
  if (!db) return null;
  const row = db.get('SELECT id, tier, last_validated_at, token_hash FROM license_cache WHERE id = 1');
  return row ? (row as unknown as LicenseCacheRow) : null;
}

/**
 * Write license data to the cache.
 */
function writeCache(tier: LicenseTier, lastValidatedAt: string): void {
  if (!db) return;
  db.run(
    'INSERT OR REPLACE INTO license_cache (id, tier, last_validated_at) VALUES (1, ?, ?)',
    [tier, lastValidatedAt]
  );
  persistDb();
}

// ---------------------------------------------------------------------------
// IPC emission
// ---------------------------------------------------------------------------

/**
 * Emit `license:tier-changed` to all BrowserWindows when the tier changes.
 */
function emitTierChanged(tier: LicenseTier): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('license:tier-changed', { tier });
    }
  }
}

/**
 * Set the current tier and emit IPC if it changed.
 */
function setTier(newTier: LicenseTier): void {
  if (newTier !== currentTier) {
    currentTier = newTier;
    emitTierChanged(currentTier);
  }
}

// ---------------------------------------------------------------------------
// Grace period logic
// ---------------------------------------------------------------------------

/**
 * Apply grace period rules based on the cached last_validated_at timestamp.
 * If within 7 days of last validation: use cached tier.
 * If > 7 days: downgrade to 'free'.
 */
function applyGracePeriod(): void {
  const cached = readCache();

  if (!cached || !cached.last_validated_at) {
    // No cache at all — downgrade to free
    setTier('free');
    return;
  }

  const lastValidated = new Date(cached.last_validated_at).getTime();
  const elapsed = Date.now() - lastValidated;

  if (elapsed <= GRACE_PERIOD_MS) {
    // Within grace period — use cached tier
    const cachedTier = parseTier(cached.tier);
    setTier(cachedTier);
  } else {
    // Grace period expired — downgrade to free
    setTier('free');
  }
}

/**
 * Parse a string into a valid LicenseTier, defaulting to 'free'.
 */
function parseTier(value: string): LicenseTier {
  if (value === 'pro' || value === 'pro+rooms') {
    return value;
  }
  return 'free';
}

// ---------------------------------------------------------------------------
// HTTP validation
// ---------------------------------------------------------------------------

/**
 * Call the Remote Web App to validate the license.
 * Uses AbortController with setTimeout for the 10-second timeout.
 */
async function callLicenseEndpoint(token: string): Promise<void> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${REMOTE_BASE_URL}/api/license/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      // 200 — parse response and cache
      const data = (await response.json()) as { tier?: string; expiresAt?: string };
      const tier = parseTier(data.tier ?? 'free');
      const now = new Date().toISOString();

      writeCache(tier, now);
      setTier(tier);
      return;
    }

    if (response.status === 401) {
      // 401 — clear token, notify user, set tier to free
      clearToken();
      setTier('free');

      if (Notification.isSupported()) {
        const notification = new Notification({
          title: 'IEOM License',
          body: 'Your session has expired. Please log in again to access premium features.',
        });
        notification.show();
      }
      return;
    }

    // Non-401 error (500, 403, 429, etc.) — apply grace period
    applyGracePeriod();
  } catch {
    // Network error or timeout (AbortError) — apply grace period
    clearTimeout(timeoutId);
    applyGracePeriod();
  }
}

// ---------------------------------------------------------------------------
// Connectivity restoration
// ---------------------------------------------------------------------------

/**
 * Handle online event — schedule re-validation within 30 seconds.
 */
function handleOnline(): void {
  if (!isOnline) {
    isOnline = true;

    // Clear any existing connectivity timer
    if (connectivityTimer) {
      clearTimeout(connectivityTimer);
    }

    // Re-validate within 30 seconds of connectivity restoration
    connectivityTimer = setTimeout(() => {
      connectivityTimer = null;
      validateLicense();
    }, CONNECTIVITY_REVALIDATION_DELAY_MS);
  }
}

/**
 * Handle offline event.
 */
function handleOffline(): void {
  isOnline = false;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate the current license.
 * If a stored token exists, calls the Remote Web App to verify the tier.
 * Applies grace period rules if the remote is unreachable.
 * Emits license:tier-changed IPC event on tier changes.
 */
export async function validateLicense(): Promise<void> {
  // Ensure database connection is open
  try {
    await openLicenseDb();
  } catch {
    // Database not ready yet (e.g., server hasn't created it) — default to free
    setTier('free');
    return;
  }

  // Load token
  const token = loadToken();

  if (!token) {
    // No token — set tier to free
    setTier('free');
    return;
  }

  // Call the remote endpoint
  await callLicenseEndpoint(token);
}

/**
 * Get the current license tier.
 */
export function getLicenseTier(): LicenseTier {
  return currentTier;
}

/**
 * Start the periodic re-validation timer (every 24 hours).
 * Also registers connectivity event listeners.
 * Should be called once after initial validation.
 */
export function startLicenseRevalidation(): void {
  // Set up 24-hour re-validation interval
  if (revalidationTimer) {
    clearInterval(revalidationTimer);
  }
  revalidationTimer = setInterval(() => {
    validateLicense();
  }, REVALIDATION_INTERVAL_MS);

  // Listen for connectivity changes via Electron's net module events
  // In Electron main process, we use powerMonitor and manual online detection
  // The 'online' and 'offline' events are available on the app
  // We use a polling approach via the net module or listen on BrowserWindow
  // For simplicity, we hook into Electron's built-in online detection
  setupConnectivityListeners();
}

/**
 * Stop the periodic re-validation timer and clean up listeners.
 */
export function stopLicenseRevalidation(): void {
  if (revalidationTimer) {
    clearInterval(revalidationTimer);
    revalidationTimer = null;
  }

  if (connectivityTimer) {
    clearTimeout(connectivityTimer);
    connectivityTimer = null;
  }
}

/**
 * Close the license database connection.
 */
export function closeLicenseDb(): void {
  if (db) {
    persistDb();
    db.close();
    db = null;
  }
}

// ---------------------------------------------------------------------------
// Connectivity listeners
// ---------------------------------------------------------------------------

/**
 * Set up listeners for online/offline events.
 * In Electron main process, we detect connectivity via periodic checks
 * or by listening to events from renderer windows.
 */
function setupConnectivityListeners(): void {
  // Use Electron's built-in online status detection from any BrowserWindow.
  // We listen for IPC messages from the renderer about connectivity,
  // but also use a simple approach: attempt a HEAD request periodically
  // when we think we're offline, and listen for the 'online' event
  // from the first available BrowserWindow's webContents.

  const checkConnectivity = (): void => {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0 && !windows[0].isDestroyed()) {
      windows[0].webContents
        .executeJavaScript('navigator.onLine')
        .then((online: boolean) => {
          if (online && !isOnline) {
            handleOnline();
          } else if (!online && isOnline) {
            handleOffline();
          }
        })
        .catch(() => {
          // Ignore errors (window might be closing)
        });
    }
  };

  // Check connectivity every 30 seconds to detect restoration
  setInterval(checkConnectivity, 30_000);
}
