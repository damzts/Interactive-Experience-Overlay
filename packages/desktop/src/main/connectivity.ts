/**
 * Connectivity monitoring module.
 * Monitors network status and triggers license re-validation on connectivity restoration.
 *
 * Local features (scenes, events, OBS bridge, ambiance) work fully offline by design:
 * the embedded Fastify server runs on localhost with SQLite — no internet dependency.
 * This module only affects remote-dependent features (license sync, stream rooms).
 *
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5
 */

import { BrowserWindow } from 'electron';
import { validateLicense } from './license.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** How often to poll connectivity status (ms). */
const POLL_INTERVAL_MS = 30_000;

/** Delay before re-validating license after connectivity is restored (ms). */
const REVALIDATION_DELAY_MS = 30_000;

/** Interval between retry attempts on re-validation failure (ms). */
const RETRY_INTERVAL_MS = 60_000;

/** Maximum number of re-validation retry attempts. */
const MAX_RETRIES = 3;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let online = true;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let revalidationTimer: ReturnType<typeof setTimeout> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryCount = 0;

// ---------------------------------------------------------------------------
// IPC emission
// ---------------------------------------------------------------------------

/**
 * Emit `connectivity:status` to all BrowserWindows.
 */
function emitConnectivityStatus(isOnline: boolean): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('connectivity:status', { online: isOnline });
    }
  }
}

// ---------------------------------------------------------------------------
// Re-validation logic
// ---------------------------------------------------------------------------

/**
 * Attempt license re-validation with retry logic.
 * On failure, retries up to MAX_RETRIES times at RETRY_INTERVAL_MS intervals.
 * After all retries exhausted, falls back to cached license tier
 * (already handled by grace period logic in license.ts).
 */
async function attemptRevalidation(): Promise<void> {
  try {
    await validateLicense();
    // Success — reset retry state
    retryCount = 0;
  } catch {
    // Failure — retry if attempts remain
    retryCount++;
    if (retryCount < MAX_RETRIES) {
      retryTimer = setTimeout(() => {
        retryTimer = null;
        attemptRevalidation();
      }, RETRY_INTERVAL_MS);
    } else {
      // All retries exhausted — fall back to cached tier (grace period handles this)
      retryCount = 0;
    }
  }
}

/**
 * Handle transition from offline → online.
 * Waits REVALIDATION_DELAY_MS then triggers license re-validation.
 */
function handleOnlineRestored(): void {
  // Clear any pending revalidation/retry timers
  clearPendingTimers();

  // Schedule re-validation after delay (Requirement 12.4: within 30 seconds)
  revalidationTimer = setTimeout(() => {
    revalidationTimer = null;
    retryCount = 0;
    attemptRevalidation();
  }, REVALIDATION_DELAY_MS);
}

/**
 * Clear pending revalidation and retry timers.
 */
function clearPendingTimers(): void {
  if (revalidationTimer) {
    clearTimeout(revalidationTimer);
    revalidationTimer = null;
  }
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  retryCount = 0;
}

// ---------------------------------------------------------------------------
// Polling
// ---------------------------------------------------------------------------

/**
 * Check connectivity by querying navigator.onLine from the first available
 * BrowserWindow. Falls back to assuming online if no window is available.
 */
function pollConnectivity(): void {
  const windows = BrowserWindow.getAllWindows();
  const win = windows.find((w) => !w.isDestroyed());

  if (!win) {
    // No window available to check — assume current state persists
    return;
  }

  win.webContents
    .executeJavaScript('navigator.onLine')
    .then((result: boolean) => {
      const previousState = online;
      online = result;

      // Emit IPC only on state change
      if (previousState !== online) {
        emitConnectivityStatus(online);

        // Trigger re-validation on offline → online transition
        if (online && !previousState) {
          handleOnlineRestored();
        }
      }
    })
    .catch(() => {
      // Ignore errors (window might be closing or not ready)
    });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialize the connectivity monitor.
 * Polls connectivity every 30 seconds and emits `connectivity:status` IPC
 * events to renderer windows on status changes.
 *
 * On transition from offline → online, triggers license re-validation
 * after a 30-second delay, with up to 3 retries at 60-second intervals.
 */
export function initConnectivityMonitor(): void {
  // Determine initial state from first available window
  const windows = BrowserWindow.getAllWindows();
  const win = windows.find((w) => !w.isDestroyed());

  if (win) {
    win.webContents
      .executeJavaScript('navigator.onLine')
      .then((result: boolean) => {
        online = result;
        emitConnectivityStatus(online);
      })
      .catch(() => {
        // Default to online if we can't determine
        online = true;
      });
  }

  // Start polling
  pollTimer = setInterval(pollConnectivity, POLL_INTERVAL_MS);
}

/**
 * Get the current connectivity status.
 * @returns true if online, false if offline.
 */
export function getConnectivityStatus(): boolean {
  return online;
}

/**
 * Clean up the connectivity monitor.
 * Stops polling and clears all pending timers.
 */
export function cleanupConnectivityMonitor(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  clearPendingTimers();
  // Reset state to defaults
  online = true;
}
