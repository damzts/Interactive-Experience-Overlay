/**
 * Embedded server lifecycle manager.
 * Manages starting, stopping, and restarting the Fastify server within the Electron main process.
 *
 * Requirements: 1.1, 1.2, 1.5, 1.7, 2.1, 2.4, 2.6, 3.6, 3.7
 */

import { app, dialog, Notification, BrowserWindow } from 'electron';
import path from 'path';
import { createDesktopServer } from '@ieom/server/desktop-entry';
import type { DesktopServer } from '@ieom/server/desktop-entry';
import { getDesktopServerPort } from './runtime-config.js';
import { loadToken } from './token-storage.js';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let server: DesktopServer | null = null;
let serverStatus: { running: boolean; error?: string } = { running: false };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const START_TIMEOUT_MS = 15_000;
const STOP_TIMEOUT_MS = 10_000;
const SERVER_PORT = getDesktopServerPort();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Emit the current server status to all renderer windows via IPC.
 */
function emitServerStatus(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('server:status', serverStatus);
    }
  }
}

/**
 * Create a timeout promise that rejects after the given duration.
 */
function createTimeout(ms: number, message: string): Promise<never> {
  return new Promise((_resolve, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  });
}

/**
 * Determine if an error is a port-in-use error (EADDRINUSE).
 */
function isPortInUseError(error: unknown): boolean {
  if (error instanceof Error) {
    return (error as NodeJS.ErrnoException).code === 'EADDRINUSE' ||
      error.message.includes('EADDRINUSE');
  }
  return false;
}

/**
 * Determine if an error is a database-related error.
 */
function isDatabaseError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes('database') ||
      msg.includes('sqlite') ||
      msg.includes('migration') ||
      msg.includes('corrupt');
  }
  return false;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Start the embedded Fastify server.
 *
 * Resolves paths for dbPath, assetsDir, overlayDir, adminDir.
 * Calls createDesktopServer then server.start() with a 15-second timeout.
 * Shows native error dialogs on failure with Retry/Quit options.
 */
export async function startServer(): Promise<void> {
  // Resolve paths
  const userData = app.getPath('userData');
  const dbPath = path.join(userData, 'ieom.db');

  // Assets directory at the project root (or bundled location)
  const appRoot = app.isPackaged
    ? path.join(process.resourcesPath, 'app')
    : path.resolve(app.getAppPath(), '..', '..');

  const assetsDir = path.join(appRoot, 'assets');
  const overlayDir = app.isPackaged
    ? path.join(process.resourcesPath, 'overlay')
    : path.join(appRoot, 'packages', 'overlay', 'dist');
  const adminDir = app.isPackaged
    ? path.join(process.resourcesPath, 'admin')
    : path.join(appRoot, 'packages', 'admin', 'dist');

  try {
    // Create and start the server with a timeout
    const startPromise = (async () => {
      server = await createDesktopServer({
        dbPath,
        port: SERVER_PORT,
        assetsDir,
        overlayDir,
        adminDir,
        getToken: loadToken,
      });
      await server.start();
    })();

    await Promise.race([
      startPromise,
      createTimeout(START_TIMEOUT_MS, `Server failed to start within ${START_TIMEOUT_MS / 1000} seconds`),
    ]);

    // Success
    serverStatus = { running: true };
    emitServerStatus();
  } catch (error: unknown) {
    server = null;
    serverStatus = { running: false, error: error instanceof Error ? error.message : String(error) };
    emitServerStatus();

    // Determine the appropriate dialog message and options
    if (isPortInUseError(error)) {
      const { response } = await dialog.showMessageBox({
        type: 'error',
        title: 'Port Conflict',
        message: `Port ${SERVER_PORT} is already in use`,
        detail: 'Another application is using the port that IEOM needs. Please close the other application and try again.',
        buttons: ['Retry', 'Quit'],
        defaultId: 0,
        cancelId: 1,
      });

      if (response === 0) {
        return startServer();
      } else {
        app.quit();
        return;
      }
    }

    if (isDatabaseError(error)) {
      await dialog.showMessageBox({
        type: 'error',
        title: 'Database Error',
        message: 'Database error',
        detail: error instanceof Error ? error.message : String(error),
        buttons: ['Quit'],
        defaultId: 0,
      });

      app.quit();
      return;
    }

    // Generic error (timeout or unhandled exception)
    const message = error instanceof Error ? error.message : String(error);
    const { response } = await dialog.showMessageBox({
      type: 'error',
      title: 'Server Error',
      message: 'Failed to start server',
      detail: message,
      buttons: ['Retry', 'Quit'],
      defaultId: 0,
      cancelId: 1,
    });

    if (response === 0) {
      return startServer();
    } else {
      app.quit();
      return;
    }
  }
}

/**
 * Stop the embedded Fastify server.
 *
 * Calls server.stop() with a 10-second timeout.
 * If the timeout is exceeded, force-terminates (resolves to allow process exit).
 */
export async function stopServer(): Promise<void> {
  if (!server) {
    return;
  }

  try {
    await Promise.race([
      server.stop(),
      createTimeout(STOP_TIMEOUT_MS, `Server stop timed out after ${STOP_TIMEOUT_MS / 1000} seconds`),
    ]);
  } catch {
    // Timeout exceeded — force-terminate by just resolving.
    // The process will exit shortly after this.
  }

  server = null;
  serverStatus = { running: false };
  emitServerStatus();
}

/**
 * Restart the embedded server (stop then start).
 * Shows a native notification when the server is available again.
 */
export async function restartServer(): Promise<void> {
  await stopServer();
  await startServer();

  // Show notification on successful restart
  if (serverStatus.running && Notification.isSupported()) {
    const notification = new Notification({
      title: 'IEOM',
      body: 'Server restarted successfully',
    });
    notification.show();
  }
}

/**
 * Get the current server status.
 */
export function getServerStatus(): { running: boolean; error?: string } {
  return { ...serverStatus };
}
