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
const BRAND_GRADIENT = 'linear-gradient(135deg, rgba(103,232,249,0.18), rgba(56,189,248,0.12) 45%, rgba(129,140,248,0.12))';
const FADE_STEPS = 8;
const FADE_STEP_MS = 20;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let adminWindow: BrowserWindow | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let splashWindow: BrowserWindow | null = null;

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
 * Get the path to the desktop app icon used by the BrowserWindow.
 */
function getWindowIconPath(): string {
  return path.join(__dirname, '..', '..', 'build', 'icon.ico');
}

/**
 * Create a small branded splash window shown while the desktop app initializes.
 */
export function createSplashWindow(): BrowserWindow {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.focus();
    return splashWindow;
  }

  splashWindow = new BrowserWindow({
    width: 480,
    height: 320,
    resizable: false,
    maximizable: false,
    minimizable: false,
    show: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: '#070b14',
    icon: getWindowIconPath(),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const splashHtml = `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          html, body { margin: 0; width: 100%; height: 100%; background: transparent; overflow: hidden; }
          body {
            display: grid;
            place-items: center;
            font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
            color: #e2e8f0;
          }
          .shell {
            width: 100%; height: 100%;
            border: 1px solid rgba(255,255,255,0.12);
            border-radius: 24px;
            background: rgba(8, 12, 20, 0.92);
            box-shadow: 0 24px 80px rgba(0,0,0,0.55);
            backdrop-filter: blur(24px);
            position: relative;
            overflow: hidden;
          }
          .shell::before {
            content: '';
            position: absolute; inset: 0;
            background: ${BRAND_GRADIENT};
          }
          .shell::after {
            content: '';
            position: absolute; inset: 0;
            background-image: linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px);
            background-size: 24px 24px;
            opacity: 0.08;
            mask-image: radial-gradient(circle at center, black 50%, transparent 100%);
          }
          .content {
            position: relative;
            z-index: 1;
            height: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 16px;
            text-align: center;
            padding: 28px;
          }
          .logo {
            width: 68px;
            height: 68px;
            border-radius: 22px;
            border: 1px solid rgba(103,232,249,0.25);
            background: rgba(8, 145, 178, 0.12);
            display: grid;
            place-items: center;
            box-shadow: 0 0 0 1px rgba(255,255,255,0.03) inset, 0 18px 36px rgba(8,145,178,0.08);
          }
          .title { font-size: 18px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
          .subtitle { font-size: 12px; color: #94a3b8; line-height: 1.5; max-width: 280px; }
          .spinner {
            width: 28px; height: 28px;
            border-radius: 999px;
            border: 2px solid rgba(148,163,184,0.22);
            border-top-color: rgba(103,232,249,0.95);
            animation: spin 0.9s linear infinite;
          }
          .status {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            font-size: 11px;
            letter-spacing: 0.16em;
            text-transform: uppercase;
            color: #cbd5e1;
          }
          @keyframes spin { to { transform: rotate(360deg); } }
        </style>
      </head>
      <body>
        <div class="shell">
          <div class="content">
            <div class="logo" aria-hidden="true">
              <svg width="34" height="34" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 9.5A2.5 2.5 0 0 1 12.5 7h7A4.5 4.5 0 0 1 24 11.5v1.2A4.5 4.5 0 0 1 21.4 16.78 4.5 4.5 0 0 1 24 20.86v.64A4.5 4.5 0 0 1 19.5 26h-7A2.5 2.5 0 0 1 10 23.5v-14Z" stroke="#A5F3FC" stroke-width="2.2" stroke-linejoin="round"/>
                <path d="M13.5 10.5v11" stroke="#E0F2FE" stroke-width="2.2" stroke-linecap="round"/>
                <path d="M17.1 10.5h2.8M17.1 16h4.2M17.1 21.5h2.8" stroke="#E0F2FE" stroke-width="2.2" stroke-linecap="round"/>
              </svg>
            </div>
            <div>
              <div class="title">IEOM</div>
              <div class="subtitle">Starting the desktop workspace and restoring your last session.</div>
            </div>
            <div class="spinner" aria-hidden="true"></div>
            <div class="status"><span>Loading</span><span>•</span><span>Desktop ready</span></div>
          </div>
        </div>
      </body>
    </html>
  `;

  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml)}`);

  splashWindow.once('ready-to-show', () => {
    splashWindow?.show();
  });

  splashWindow.on('closed', () => {
    splashWindow = null;
  });

  return splashWindow;
}

/**
 * Close the splash window if it is visible.
 */
export function closeSplashWindow(): void {
  if (splashWindow && !splashWindow.isDestroyed()) {
    const currentSplash = splashWindow;
    splashWindow = null;

    try {
      const startOpacity = typeof currentSplash.getOpacity === 'function' ? currentSplash.getOpacity() : 1;
      let step = 0;

      const timer = setInterval(() => {
        if (currentSplash.isDestroyed()) {
          clearInterval(timer);
          return;
        }

        step += 1;
  const nextOpacity = Math.max(0, startOpacity * (1 - step / FADE_STEPS));

        try {
          currentSplash.setOpacity(nextOpacity);
        } catch {
          clearInterval(timer);
          currentSplash.close();
          return;
        }

        if (step >= FADE_STEPS || nextOpacity <= 0) {
          clearInterval(timer);
          currentSplash.close();
        }
      }, FADE_STEP_MS);
    } catch {
      currentSplash.close();
    }
  }
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
    icon: getWindowIconPath(),
    backgroundColor: '#070b14',
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

    try {
      adminWindow.setOpacity(0);
      let step = 0;

      const timer = setInterval(() => {
        if (!adminWindow || adminWindow.isDestroyed()) {
          clearInterval(timer);
          return;
        }

        step += 1;
  const nextOpacity = Math.min(1, step / FADE_STEPS);

        try {
          adminWindow.setOpacity(nextOpacity);
        } catch {
          clearInterval(timer);
          return;
        }

        if (step >= FADE_STEPS || nextOpacity >= 1) {
          clearInterval(timer);
        }
      }, FADE_STEP_MS);
    } catch {
      // If opacity is unsupported on this platform, just show the window normally.
    }
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
