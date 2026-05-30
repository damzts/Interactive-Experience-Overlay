import { app, BrowserWindow } from 'electron';
import path from 'path';
import { startServer, stopServer } from './server.js';
import { createAdminWindow, showAdminWindow } from './window.js';
import { createTray } from './tray.js';
import { registerProtocolHandler, handleDeepLink } from './deeplink.js';
import { validateLicense, startLicenseRevalidation } from './license.js';
import { registerIpcHandlers } from './ipc-handlers.js';
import { initAutoUpdater, checkForUpdates, cleanupAutoUpdater } from './auto-updater.js';
import { initConnectivityMonitor, cleanupConnectivityMonitor } from './connectivity.js';
import { isAutoLaunched, openAppSettingsDb, closeAppSettingsDb } from './startup.js';

// ---------------------------------------------------------------------------
// Single-Instance Lock
// ---------------------------------------------------------------------------
// If another instance is already running, focus its window and quit this one.
const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  // When a second instance is launched, focus the existing window.
  // On Windows/Linux, deep link URLs arrive here as argv.
  app.on('second-instance', (_event, argv) => {
    showAdminWindow();

    // On Windows/Linux, protocol URLs are passed as command-line arguments.
    const deepLinkUrl = argv.find((arg) => arg.startsWith('ieom://'));
    if (deepLinkUrl) {
      handleDeepLink(deepLinkUrl);
    }
  });

  // ---------------------------------------------------------------------------
  // Protocol Registration
  // ---------------------------------------------------------------------------
  // Register ieom:// as the default protocol client for deep link auth.
  // This must be called before app 'ready' on some platforms.
  registerProtocolHandler();

  // ---------------------------------------------------------------------------
  // App Lifecycle: ready
  // ---------------------------------------------------------------------------
  app.whenReady().then(async () => {
    // Register IPC handlers before creating windows
    registerIpcHandlers();

    // Startup sequence: server → tray → (conditional) admin window → license
    await startServer();

    // Open app settings DB (the server creates the DB file during startup)
    try {
      const dbPath = path.join(app.getPath('userData'), 'ieom.db');
      await openAppSettingsDb(dbPath);
    } catch {
      // If the database isn't ready yet, startup settings will use defaults
    }

    await createTray();

    // When started via auto-launch (login item): stay minimized to tray.
    // When started via user action (double-click/shortcut): show Admin Window.
    if (!isAutoLaunched()) {
      await createAdminWindow();
    }

    await validateLicense();
    startLicenseRevalidation();

    // Initialize connectivity monitoring (polls every 30s, triggers license
    // re-validation on offline → online transitions)
    initConnectivityMonitor();

    // Initialize auto-updater and check for updates on start
    initAutoUpdater();
    checkForUpdates();
  });

  // ---------------------------------------------------------------------------
  // App Lifecycle: window-all-closed
  // ---------------------------------------------------------------------------
  // Do NOT quit when all windows are closed — minimize to tray instead.
  app.on('window-all-closed', () => {
    // Intentionally empty: prevents default quit behavior.
    // The app stays alive in the system tray.
  });

  // ---------------------------------------------------------------------------
  // App Lifecycle: activate (macOS)
  // ---------------------------------------------------------------------------
  // On macOS, re-show the admin window when the dock icon is clicked.
  app.on('activate', () => {
    showAdminWindow();
  });

  // ---------------------------------------------------------------------------
  // Deep Link: open-url (macOS)
  // ---------------------------------------------------------------------------
  // On macOS, protocol URLs arrive via the 'open-url' event.
  app.on('open-url', (event, url) => {
    event.preventDefault();
    handleDeepLink(url);
  });

  // ---------------------------------------------------------------------------
  // Graceful Shutdown
  // ---------------------------------------------------------------------------
  app.on('before-quit', async () => {
    cleanupAutoUpdater();
    cleanupConnectivityMonitor();
    closeAppSettingsDb();
    await stopServer();
  });
}
