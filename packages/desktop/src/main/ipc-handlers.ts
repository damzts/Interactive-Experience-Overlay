/**
 * IPC channel handlers for the Electron main process.
 * Registers all IPC handlers that the preload script exposes to the renderer,
 * including license tier queries, auth flows, feature gating, server status,
 * and app version requests.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 5.2, 5.7
 */

import { ipcMain, app, BrowserWindow } from 'electron';
import { getLicenseTier, validateLicense, type LicenseTier } from './license.js';
import { getAdminToken } from './server.js';
import { clearToken } from './token-storage.js';
import { getLaunchAtStartup, setLaunchAtStartup } from './startup.js';
import { installUpdate } from './auto-updater.js';
import { startOAuthFlow } from './oauth-flow.js';
import { joinRoom, leaveRoom, getRoomStatus } from './room-service.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Feature gate map: maps feature identifiers to the minimum required license tier.
 */
export const FEATURE_GATES: Record<string, LicenseTier> = {
  'stream-rooms': 'pro+rooms',
  'advanced-ambiance-presets': 'pro',
  'priority-support': 'pro',
};

// ---------------------------------------------------------------------------
// Tier ordering
// ---------------------------------------------------------------------------

/**
 * Numeric ordering for license tiers.
 * free < pro < pro+rooms
 */
const TIER_ORDER: Record<LicenseTier, number> = {
  free: 0,
  pro: 1,
  'pro+rooms': 2,
};

// ---------------------------------------------------------------------------
// Feature gating helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if the given tier meets or exceeds the required tier for a feature.
 * Tier ordering: free < pro < pro+rooms
 */
export function isFeatureEnabled(feature: string, tier: LicenseTier): boolean {
  const requiredTier = FEATURE_GATES[feature];
  if (!requiredTier) {
    // Unknown features are enabled by default (no gate)
    return true;
  }
  return TIER_ORDER[tier] >= TIER_ORDER[requiredTier];
}

/**
 * Returns the minimum tier required for a feature, or undefined if the feature has no gate.
 */
export function getRequiredTier(feature: string): LicenseTier | undefined {
  return FEATURE_GATES[feature];
}

// ---------------------------------------------------------------------------
// IPC broadcast helpers
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
 * Broadcast the current server status to all renderer windows.
 */
export function broadcastServerStatus(status: { running: boolean; error?: string }): void {
  broadcastToAllWindows('server:status', status);
}

/**
 * Broadcast a license tier change to all renderer windows.
 */
export function broadcastTierChanged(tier: LicenseTier, expiresAt?: string): void {
  broadcastToAllWindows('license:tier-changed', { tier, expiresAt });
}

/**
 * Broadcast auth status change to all renderer windows.
 */
export function broadcastAuthStatus(status: { authenticated: boolean; user?: object }): void {
  broadcastToAllWindows('auth:status', status);
}

// ---------------------------------------------------------------------------
// IPC Handler Registration
// ---------------------------------------------------------------------------

/**
 * Register all IPC handlers. Called once during app startup.
 * Sets up handlers for license queries, auth flows, app info, and update triggers.
 */
export function registerIpcHandlers(): void {
  // -------------------------------------------------------------------------
  // License: get current tier
  // -------------------------------------------------------------------------
  ipcMain.handle('license:get-tier', () => {
    return { tier: getLicenseTier() };
  });

  // -------------------------------------------------------------------------
  // Auth: login — open OAuth window with Google consent screen
  // -------------------------------------------------------------------------
  ipcMain.handle('auth:login', async () => {
    await startOAuthFlow();
  });

  // -------------------------------------------------------------------------
  // Auth: logout — clear token, reset tier, notify renderer
  // -------------------------------------------------------------------------
  ipcMain.handle('auth:logout', () => {
    clearToken();

    // Broadcast auth status change
    broadcastAuthStatus({ authenticated: false });

    // Broadcast tier reset to free
    broadcastTierChanged('free');

    // Re-validate license (will resolve to 'free' since token is cleared)
    validateLicense();
  });

  // -------------------------------------------------------------------------
  // App: get version
  // -------------------------------------------------------------------------
  ipcMain.handle('app:get-version', () => {
    return app.getVersion();
  });

  // -------------------------------------------------------------------------
  // Update: install — triggers auto-updater to quit and install
  // -------------------------------------------------------------------------
  ipcMain.handle('update:install', () => {
    installUpdate();
  });

  // -------------------------------------------------------------------------
  // Startup: get launch-at-startup preference
  // -------------------------------------------------------------------------
  ipcMain.handle('startup:get-launch-at-startup', () => {
    return { enabled: getLaunchAtStartup() };
  });

  // -------------------------------------------------------------------------
  // Startup: set launch-at-startup preference
  // -------------------------------------------------------------------------
  ipcMain.handle('startup:set-launch-at-startup', (_event, enabled: boolean) => {
    setLaunchAtStartup(enabled);
    return { enabled: getLaunchAtStartup() };
  });

  // -------------------------------------------------------------------------
  // Room: join a cloud room
  // -------------------------------------------------------------------------
  ipcMain.handle('room:join', async (_event, roomId: string, cloudUrl: string) => {
    await joinRoom(roomId, cloudUrl);
    return getRoomStatus();
  });

  // -------------------------------------------------------------------------
  // Room: leave current room
  // -------------------------------------------------------------------------
  ipcMain.handle('room:leave', async () => {
    await leaveRoom();
    return getRoomStatus();
  });

  // -------------------------------------------------------------------------
  // Server: get admin token (for IPC delivery — not URL injection)
  // -------------------------------------------------------------------------
  ipcMain.handle('server:get-admin-token', () => {
    return getAdminToken() ?? null;
  });

  // -------------------------------------------------------------------------
  // Room: get status
  // -------------------------------------------------------------------------
  ipcMain.handle('room:status', () => {
    return getRoomStatus();
  });
}
