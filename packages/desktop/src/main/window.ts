/**
 * Admin BrowserWindow manager.
 * Creates, shows, hides, and persists the admin window state.
 *
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 1.4
 */

import { app, BrowserWindow, screen } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  openWindowStateDb,
  closeWindowStateDb,
  loadWindowBounds,
  saveWindowBounds,
  type WindowBounds,
} from './window-state.js';
import { loadToken } from './token-storage.js';
import { getDesktopAdminUrl, getDesktopServerPort } from './runtime-config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_WIDTH = 1024;
const MIN_HEIGHT = 768;
const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 800;
const DESKTOP_SERVER_PORT = getDesktopServerPort();
const ADMIN_URL = getDesktopAdminUrl();
const PERSIST_DEBOUNCE_MS = 500;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let adminWindow: BrowserWindow | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Get the path to the SQLite database file.
 */
function getDbPath(): string {
  return path.join(app.getPath('userData'), 'ieom.db');
}

/**
 * Get the path to the preload script.
 * In compiled output, preload/index.js is a sibling directory to main/.
 */
function getPreloadPath(): string {
  return path.join(__dirname, '..', 'preload', 'index.js');
}

/**
 * Determine if a given rectangle is visible on any connected display.
 * A window is considered "out of bounds" if its top-left corner is not
 * within any display's work area.
 */
function isWithinDisplayBounds(x: number, y: number, width: number, height: number): boolean {
  const displays = screen.getAllDisplays();

  for (const display of displays) {
    const { x: dx, y: dy, width: dw, height: dh } = display.workArea;

    // Check if at least a portion of the window overlaps with this display
    const overlapX = x < dx + dw && x + width > dx;
    const overlapY = y < dy + dh && y + height > dy;

    if (overlapX && overlapY) {
      return true;
    }
  }

  return false;
}

/**
 * Get default bounds centered on the primary display.
 */
function getDefaultBounds(): { x: number; y: number; width: number; height: number } {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workArea;
  const { x: screenX, y: screenY } = primaryDisplay.workArea;

  return {
    x: screenX + Math.round((screenWidth - DEFAULT_WIDTH) / 2),
    y: screenY + Math.round((screenHeight - DEFAULT_HEIGHT) / 2),
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
  };
}

/**
 * Debounced persist of current window bounds to SQLite.
 */
function schedulePersistBounds(): void {
  if (persistTimer) {
    clearTimeout(persistTimer);
  }

  persistTimer = setTimeout(() => {
    persistTimer = null;
    if (!adminWindow || adminWindow.isDestroyed()) return;

    const isMaximized = adminWindow.isMaximized();
    // When maximized, persist the restore bounds (pre-maximize position/size)
    const bounds = isMaximized ? adminWindow.getNormalBounds() : adminWindow.getBounds();

    saveWindowBounds({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized,
    });
  }, PERSIST_DEBOUNCE_MS);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create the Admin BrowserWindow.
 *
 * - Loads saved window bounds from SQLite `window_state` table
 * - Validates bounds are within available displays; resets to center if not
 * - Creates BrowserWindow with minWidth 1024, minHeight 768, autoHideMenuBar
 * - Loads `http://localhost:3000/admin`
 * - On 'close': prevents default, hides window (minimize to tray)
 * - On 'resize'/'move': debounces and persists bounds to SQLite
 */
export async function createAdminWindow(): Promise<void> {
  if (adminWindow && !adminWindow.isDestroyed()) {
    adminWindow.show();
    adminWindow.focus();
    return;
  }

  // Open the window state database connection
  try {
    await openWindowStateDb(getDbPath());
  } catch {
    // If the database isn't ready yet, we'll use defaults
  }

  // Load persisted bounds
  const savedBounds = loadWindowBounds();
  let windowOptions: { x?: number; y?: number; width: number; height: number; isMaximized: boolean };

  if (savedBounds && savedBounds.x !== null && savedBounds.y !== null) {
    // Validate that saved position is within current display bounds
    if (isWithinDisplayBounds(savedBounds.x, savedBounds.y, savedBounds.width, savedBounds.height)) {
      windowOptions = {
        x: savedBounds.x,
        y: savedBounds.y,
        width: Math.max(savedBounds.width, MIN_WIDTH),
        height: Math.max(savedBounds.height, MIN_HEIGHT),
        isMaximized: savedBounds.isMaximized,
      };
    } else {
      // Out of bounds — reset to center of primary display
      const defaults = getDefaultBounds();
      windowOptions = { ...defaults, isMaximized: false };
    }
  } else if (savedBounds) {
    // Has saved size but no position — use saved size, center on primary
    const defaults = getDefaultBounds();
    windowOptions = {
      x: defaults.x,
      y: defaults.y,
      width: Math.max(savedBounds.width, MIN_WIDTH),
      height: Math.max(savedBounds.height, MIN_HEIGHT),
      isMaximized: savedBounds.isMaximized,
    };
  } else {
    // No saved state at all — use defaults
    const defaults = getDefaultBounds();
    windowOptions = { ...defaults, isMaximized: false };
  }

  // Create the BrowserWindow
  adminWindow = new BrowserWindow({
    x: windowOptions.x,
    y: windowOptions.y,
    width: windowOptions.width,
    height: windowOptions.height,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    autoHideMenuBar: true,
    show: false, // Show after ready-to-show to avoid flash
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Show window when ready (avoids white flash)
  adminWindow.once('ready-to-show', () => {
    if (!adminWindow) return;

    if (windowOptions.isMaximized) {
      adminWindow.maximize();
    }

    adminWindow.show();
  });

  // ---------------------------------------------------------------------------
  // Event: close — hide instead of destroy (minimize to tray)
  // ---------------------------------------------------------------------------
  adminWindow.on('close', (event) => {
    // Prevent the window from being destroyed; hide it instead.
    // The app stays alive in the system tray.
    if (adminWindow && !adminWindow.isDestroyed()) {
      event.preventDefault();
      adminWindow.hide();
    }
  });

  // ---------------------------------------------------------------------------
  // Events: resize / move — debounce and persist bounds
  // ---------------------------------------------------------------------------
  adminWindow.on('resize', schedulePersistBounds);
  adminWindow.on('move', schedulePersistBounds);

  // Also persist when maximized/unmaximized state changes
  adminWindow.on('maximize', schedulePersistBounds);
  adminWindow.on('unmaximize', schedulePersistBounds);

  // ---------------------------------------------------------------------------
  // Event: closed — clean up reference
  // ---------------------------------------------------------------------------
  adminWindow.on('closed', () => {
    adminWindow = null;
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
  });

  // Load the admin UI from the embedded server
  await adminWindow.loadURL(ADMIN_URL);

  const token = loadToken();
  if (token) {
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString()) as {
        sub?: string
        email?: string
        name?: string
        userId?: string
        id?: string
      };

      adminWindow.webContents?.send?.('auth:status', {
        authenticated: true,
        user: {
          id: payload.userId ?? payload.sub ?? payload.id ?? 'desktop-user',
          email: payload.email ?? 'local@desktop',
          name: payload.name ?? payload.email ?? 'Desktop User',
        },
      });
    } catch {
      adminWindow.webContents?.send?.('auth:status', { authenticated: false });
    }
  } else {
    adminWindow.webContents?.send?.('auth:status', { authenticated: false });
  }
}

/**
 * Show or focus the existing Admin Window.
 * If the window was destroyed or doesn't exist, recreate it.
 */
export function showAdminWindow(): void {
  if (adminWindow && !adminWindow.isDestroyed()) {
    if (adminWindow.isMinimized()) {
      adminWindow.restore();
    }
    adminWindow.show();
    adminWindow.focus();
  } else {
    // Window was destroyed — recreate it
    createAdminWindow();
  }
}

/**
 * Get the Admin BrowserWindow instance (if created and not destroyed).
 */
export function getAdminWindow(): BrowserWindow | null {
  if (adminWindow && !adminWindow.isDestroyed()) {
    return adminWindow;
  }
  return null;
}

/**
 * Clean up window state resources.
 * Call this during app shutdown.
 */
export function cleanupWindowState(): void {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  closeWindowStateDb();
}
