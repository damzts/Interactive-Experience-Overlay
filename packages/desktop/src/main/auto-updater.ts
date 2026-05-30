/**
 * Auto-updater module using electron-updater.
 * Checks for updates on app start, downloads in the background,
 * notifies the user via native OS notification when ready, and
 * handles retry logic for failed downloads.
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8
 */

import electronUpdater from 'electron-updater';
import type { UpdateInfo } from 'electron-updater';
const { autoUpdater } = electronUpdater;
import { Notification, BrowserWindow } from 'electron';
import { logger } from './logger.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of download retry attempts. */
const MAX_RETRY_ATTEMPTS = 3;

/** Interval between retry attempts in milliseconds (5 minutes). */
const RETRY_INTERVAL_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** Current download attempt count (resets on successful download). */
let downloadAttempts = 0;

/** Whether an update has been downloaded and is pending install. */
let updatePending = false;

/** Timer handle for scheduled retries. */
let retryTimer: ReturnType<typeof setTimeout> | null = null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Broadcast a message to all renderer windows.
 */
function broadcastToAllWindows(channel: string, data: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, data);
    }
  }
}

/**
 * Show a native OS notification.
 */
function showNotification(title: string, body: string): void {
  if (Notification.isSupported()) {
    const notification = new Notification({ title, body });
    notification.show();
  }
}

/**
 * Schedule a retry for checking/downloading updates.
 */
function scheduleRetry(): void {
  if (retryTimer) {
    clearTimeout(retryTimer);
  }

  retryTimer = setTimeout(() => {
    retryTimer = null;
    checkForUpdates();
  }, RETRY_INTERVAL_MS);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialize the auto-updater.
 * Configures electron-updater settings and registers event listeners
 * for the update lifecycle.
 *
 * Call this once during app startup, after the app is ready.
 */
export function initAutoUpdater(): void {
  // Reset internal state
  downloadAttempts = 0;
  updatePending = false;
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }

  // Configure auto-updater behavior
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  // ---------------------------------------------------------------------------
  // Event: update-available
  // ---------------------------------------------------------------------------
  autoUpdater.on('update-available', (info: UpdateInfo) => {
    logger.info(`[auto-updater] Update available: v${info.version}`);

    // Emit IPC event to renderer with version info
    broadcastToAllWindows('update:available', { version: info.version });
  });

  // ---------------------------------------------------------------------------
  // Event: update-not-available
  // ---------------------------------------------------------------------------
  autoUpdater.on('update-not-available', () => {
    logger.info('[auto-updater] No update available.');
  });

  // ---------------------------------------------------------------------------
  // Event: download-progress
  // ---------------------------------------------------------------------------
  autoUpdater.on('download-progress', (progress) => {
    logger.info(
      `[auto-updater] Download progress: ${progress.percent.toFixed(1)}% ` +
        `(${progress.transferred}/${progress.total})`
    );
  });

  // ---------------------------------------------------------------------------
  // Event: update-downloaded
  // ---------------------------------------------------------------------------
  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    logger.info(`[auto-updater] Update downloaded: v${info.version}`);

    // Reset retry state on successful download
    downloadAttempts = 0;
    updatePending = true;

    // Notify user via native OS notification
    showNotification(
      'Update Ready',
      `IEOM v${info.version} has been downloaded and is ready to install.`
    );
  });

  // ---------------------------------------------------------------------------
  // Event: error
  // ---------------------------------------------------------------------------
  autoUpdater.on('error', (error: Error) => {
    logger.error(`[auto-updater] Error: ${error.message}`);

    downloadAttempts++;

    if (downloadAttempts < MAX_RETRY_ATTEMPTS) {
      logger.info(
        `[auto-updater] Scheduling retry ${downloadAttempts}/${MAX_RETRY_ATTEMPTS} ` +
          `in ${RETRY_INTERVAL_MS / 1000}s`
      );
      scheduleRetry();
    } else {
      // Max retries exhausted — notify user and give up
      logger.error('[auto-updater] Max retry attempts reached. Giving up.');
      downloadAttempts = 0;

      showNotification(
        'Update Failed',
        'Failed to download the update after multiple attempts. The update will be retried on next app start.'
      );
    }
  });

  logger.info('[auto-updater] Initialized.');
}

/**
 * Check for available updates.
 * Called on app start and after retry intervals.
 *
 * electron-updater handles code signature verification automatically.
 * If verification fails, the 'error' event is emitted and the update
 * is discarded (not applied).
 */
export function checkForUpdates(): void {
  logger.info('[auto-updater] Checking for updates...');
  autoUpdater.checkForUpdates().catch((err: Error) => {
    logger.error(`[auto-updater] Failed to check for updates: ${err.message}`);
  });
}

/**
 * Install the pending update and restart the application.
 * This is triggered by the `update:install` IPC handler.
 *
 * If no update is pending, this is a no-op.
 */
export function installUpdate(): void {
  if (!updatePending) {
    logger.warn('[auto-updater] installUpdate called but no update is pending.');
    return;
  }

  logger.info('[auto-updater] Installing update and restarting...');
  autoUpdater.quitAndInstall();
}

/**
 * Returns whether an update has been downloaded and is pending install.
 */
export function isUpdatePending(): boolean {
  return updatePending;
}

/**
 * Clean up any pending retry timers.
 * Call this during app shutdown.
 */
export function cleanupAutoUpdater(): void {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}
