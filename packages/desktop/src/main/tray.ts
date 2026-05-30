/**
 * System tray icon and context menu manager.
 * Provides quick access to show window, restart server, and quit.
 *
 * Requirements: 1.4, 1.5, 1.6, 1.7, 1.8
 */

import { app, Tray, Menu, nativeImage } from 'electron';
import { showAdminWindow } from './window.js';
import { restartServer, stopServer } from './server.js';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let tray: Tray | null = null;
let isServerRunning = true;

// ---------------------------------------------------------------------------
// Icon Helpers
// ---------------------------------------------------------------------------

/**
 * Create a simple 16x16 tray icon as a programmatic nativeImage.
 * Green circle = server running, red circle = server stopped.
 * In production this would be replaced with proper icon assets.
 */
function createTrayIcon(running: boolean): Electron.NativeImage {
  // 16x16 RGBA raw pixel buffer
  const size = 16;
  const buffer = Buffer.alloc(size * size * 4);

  const r = running ? 0x4c : 0xe0;
  const g = running ? 0xaf : 0x3e;
  const b = running ? 0x50 : 0x3e;

  const centerX = size / 2;
  const centerY = size / 2;
  const radius = 6;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const offset = (y * size + x) * 4;
      const dx = x - centerX + 0.5;
      const dy = y - centerY + 0.5;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= radius) {
        buffer[offset] = r;
        buffer[offset + 1] = g;
        buffer[offset + 2] = b;
        buffer[offset + 3] = 255;
      } else {
        // Transparent
        buffer[offset] = 0;
        buffer[offset + 1] = 0;
        buffer[offset + 2] = 0;
        buffer[offset + 3] = 0;
      }
    }
  }

  return nativeImage.createFromBuffer(buffer, { width: size, height: size });
}

/**
 * Get the tooltip text based on server running state.
 */
function getTooltip(running: boolean): string {
  return running ? 'IEOM - Running' : 'IEOM - Stopped';
}

// ---------------------------------------------------------------------------
// Context Menu
// ---------------------------------------------------------------------------

/**
 * Build the tray context menu with Show Window, Restart Server, and Quit options.
 */
function buildContextMenu(): Electron.Menu {
  return Menu.buildFromTemplate([
    {
      label: 'Show Window',
      click: () => {
        showAdminWindow();
      },
    },
    {
      label: 'Restart Server',
      click: () => {
        restartServer();
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: async () => {
        await stopServer();
        app.quit();
      },
    },
  ]);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create the system tray icon with context menu.
 * The tray indicates server running/stopped state and provides
 * "Show Window", "Restart Server", and "Quit" options.
 *
 * On tray click (not right-click): shows/focuses the Admin Window.
 */
export async function createTray(): Promise<void> {
  const icon = createTrayIcon(isServerRunning);
  tray = new Tray(icon);

  tray.setToolTip(getTooltip(isServerRunning));
  tray.setContextMenu(buildContextMenu());

  // On tray icon click (left-click), show/focus the Admin Window.
  tray.on('click', () => {
    showAdminWindow();
  });
}

/**
 * Update the tray icon and tooltip to reflect current server status.
 * Call this whenever the server status changes.
 */
export function updateTrayStatus(running: boolean): void {
  isServerRunning = running;

  if (!tray) {
    return;
  }

  tray.setImage(createTrayIcon(running));
  tray.setToolTip(getTooltip(running));
}
