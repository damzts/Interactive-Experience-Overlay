import { app } from 'electron';
import path from 'path';
import { startServer, stopServer } from './server.js';
import { createAdminWindow, showAdminWindow, createSplashWindow, closeSplashWindow } from './window.js';
import { createTray } from './tray.js';
import { registerProtocolHandler, handleDeepLink } from './deeplink.js';
import { validateLicense, startLicenseRevalidation } from './license.js';
import { registerIpcHandlers } from './ipc-handlers.js';
import { initAutoUpdater, checkForUpdates, cleanupAutoUpdater } from './auto-updater.js';
import { initConnectivityMonitor, cleanupConnectivityMonitor } from './connectivity.js';
import { isAutoLaunched, openAppSettingsDb, closeAppSettingsDb } from './startup.js';
import { loadToken } from './token-storage.js';
import { broadcastAuthStatus } from './ipc-handlers.js';
import { startGlobalShortcuts, stopGlobalShortcuts } from './global-shortcuts.js';

// ---------------------------------------------------------------------------
// Crash Handlers — ensure the process exits on fatal errors
// ---------------------------------------------------------------------------
process.on('uncaughtException', (err) => {
  console.error('[IEOM] Uncaught exception:', err);
  app.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[IEOM] Unhandled rejection:', reason);
  app.exit(1);
});

// ---------------------------------------------------------------------------
// Session Restore — load persisted token on startup
// ---------------------------------------------------------------------------

/**
 * Attempt to restore a previously saved session by loading the token from
 * safeStorage. If a valid JWT token is found, decode its payload and
 * broadcast an authenticated status so the renderer never shows a login
 * flash. Invalid / corrupted tokens are silently ignored (renderer will
 * show login as normal).
 */
async function restoreSession(): Promise<void> {
  try {
    const token = loadToken();
    if (!token) {
      // No saved session — renderer will show login.
      broadcastAuthStatus({ authenticated: false });
      return;
    }

    // Decode the JWT payload (best-effort; backend already verified validity)
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1]!, 'base64url').toString(),
    ) as {
      sub?: string;
      email?: string;
      name?: string;
      userId?: string;
      id?: string;
      exp?: number;
    };

    // Skip if token is expired (renderer will do a full check later)
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      console.log('[session-restore] Token expired — renderer will request re-auth');
      broadcastAuthStatus({ authenticated: false });
      return;
    }

    broadcastAuthStatus({
      authenticated: true,
      user: {
        id: payload.userId ?? payload.sub ?? payload.id ?? 'desktop-user',
        email: payload.email ?? '',
        name: payload.name ?? payload.email ?? 'User',
      },
    });

    console.log('[session-restore] Session restored successfully');
  } catch {
    // Corrupted token / decode failure — start fresh
    broadcastAuthStatus({ authenticated: false });
  }
}

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

    const splashWindow = createSplashWindow();

    // Startup sequence: server → tray → (conditional) admin window → license
    await startServer();

    // Bridge OS-level global hotkeys to the server's keybind actions so
    // configured keybinds still fire while the Admin Window is unfocused
    // or minimized to the tray.
    startGlobalShortcuts();

    // Open app settings DB (the server creates the DB file during startup)
    try {
      const dbPath = path.join(app.getPath('userData'), 'ieom.db');
      openAppSettingsDb(dbPath);
    } catch {
      // If the database isn't ready yet, startup settings will use defaults
    }

    // -----------------------------------------------------------------------
    // Session restore: load persisted token before creating any windows so
    // the renderer receives auth status immediately on mount (no flash of
    // login screen). The broadcast reaches all BrowserWindows created after
    // this point via `broadcastAuthStatus`.
    // -----------------------------------------------------------------------
    await restoreSession();

    await createTray();

    // When started via auto-launch (login item): stay minimized to tray.
    // When started via user action (double-click/shortcut): show Admin Window.
    if (!isAutoLaunched()) {
      await createAdminWindow();
    }

    if (splashWindow && !splashWindow.isDestroyed()) {
      closeSplashWindow();
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
  let isQuitting = false;
  app.on('before-quit', (event) => {
    if (isQuitting) return;
    isQuitting = true;
    event.preventDefault();

    cleanupAutoUpdater();
    cleanupConnectivityMonitor();
    closeAppSettingsDb();
    stopGlobalShortcuts();

    // Hard kill after 5s if graceful stop hangs
    setTimeout(() => process.exit(0), 5000).unref();

    stopServer()
      .finally(() => process.exit(0));
  });
}
