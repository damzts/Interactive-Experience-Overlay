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
import Database from 'better-sqlite3';
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

let db: Database.Database | null = null;
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
function openLicenseDb(): void {
  if (db) return;
  const dbPath = join(app.getPath('userData'), 'ieom.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  // Ensure the license_cache table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS license_cache (
      id INTEGER PRIMARY KEY DEFAULT 1,
      tier TEXT NOT NULL DEFAULT 'free',
      last_validated_at TEXT,
      token_hash TEXT
    )
  `);
}

/**
 * Read the cached license data from the database.
 */
function readCache(): LicenseCacheRow | null {
  if (!db) return null;
  return (db.prepare('SELECT id, tier, last_validated_at, token_hash FROM license_cache WHERE id = 1').get() as LicenseCacheRow | undefined) ?? null;
}

/**
 * Write license data to the cache.
 */
function writeCache(tier: LicenseTier, lastValidatedAt: string): void {
  if (!db) return;
  db.prepare('INSERT OR REPLACE INTO license_cache (id, tier, last_validated_at) VALUES (1, ?, ?)').run(tier, lastValidatedAt);
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
    setTier('free');
    return;
  }

  const lastValidated = new Date(cached.last_validated_at).getTime();
  const elapsed = Date.now() - lastValidated;

  if (elapsed <= GRACE_PERIOD_MS) {
    setTier(parseTier(cached.tier));
  } else {
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
 */
async function callLicenseEndpoint(token: string): Promise<void> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${REMOTE_BASE_URL}/api/license/me`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = (await response.json()) as { tier?: string; expiresAt?: string };
      const tier = parseTier(data.tier ?? 'free');
      writeCache(tier, new Date().toISOString());
      setTier(tier);
      return;
    }

    if (response.status === 401) {
      clearToken();
      setTier('free');

      if (Notification.isSupported()) {
        new Notification({
          title: 'IEOM License',
          body: 'Your session has expired. Please log in again to access premium features.',
        }).show();
      }
      return;
    }

    applyGracePeriod();
  } catch {
    clearTimeout(timeoutId);
    applyGracePeriod();
  }
}

// ---------------------------------------------------------------------------
// Connectivity restoration
// ---------------------------------------------------------------------------

function handleOnline(): void {
  if (!isOnline) {
    isOnline = true;
    if (connectivityTimer) clearTimeout(connectivityTimer);
    connectivityTimer = setTimeout(() => {
      connectivityTimer = null;
      validateLicense();
    }, CONNECTIVITY_REVALIDATION_DELAY_MS);
  }
}

function handleOffline(): void {
  isOnline = false;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate the current license.
 */
export async function validateLicense(): Promise<void> {
  try {
    openLicenseDb();
  } catch {
    // Database not ready yet (e.g., server hasn't created it) — default to free
    setTier('free');
    return;
  }

  const token = loadToken();
  if (!token) {
    setTier('free');
    return;
  }

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
 */
export function startLicenseRevalidation(): void {
  if (revalidationTimer) clearInterval(revalidationTimer);
  revalidationTimer = setInterval(() => { validateLicense(); }, REVALIDATION_INTERVAL_MS);

}

/**
 * Stop the periodic re-validation timer and clean up listeners.
 */
export function stopLicenseRevalidation(): void {
  if (revalidationTimer) { clearInterval(revalidationTimer); revalidationTimer = null; }
  if (connectivityTimer) { clearTimeout(connectivityTimer); connectivityTimer = null; }
}

/**
 * Close the license database connection.
 */
export function closeLicenseDb(): void {
  if (db) { db.close(); db = null; }
}


