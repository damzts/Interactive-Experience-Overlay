/**
 * Global keybind bridge — registers OS-wide hotkeys via Electron's
 * `globalShortcut` module so keybinds configured in the admin panel's
 * Input Engine still fire when the Admin Window is unfocused or minimized
 * to the tray (browsers/renderers only receive keydown events while
 * focused; globalShortcut runs at the OS level regardless of focus).
 *
 * The main process connects to the embedded local server as a socket.io
 * client (same auth contract as the admin renderer — clientType 'admin' +
 * the generated admin token) and emits the same 'keybind:execute' event
 * the admin UI uses, so both paths dispatch through identical server-side
 * logic. Keybinds are fetched once on connect and refreshed whenever the
 * server broadcasts a config:patch containing an updated keybind map.
 */

import { globalShortcut } from 'electron';
import { io, type Socket } from 'socket.io-client';
import type { AppConfig } from '@ieomlabs/shared';
import { getDesktopServerPort } from './runtime-config.js';
import { getAdminToken } from './server.js';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let socket: Socket | null = null;
let registeredKeys: string[] = [];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getServerBaseUrl(): string {
  return `http://127.0.0.1:${getDesktopServerPort()}`;
}

/**
 * Translate a captured browser key label (e.g. "F2", "Space", "a") into an
 * Electron Accelerator string. Electron's format matches most single-key
 * labels already; a few browser-specific labels need remapping.
 */
function toAccelerator(key: string): string | null {
  const trimmed = key.trim();
  if (!trimmed) return null;
  if (trimmed === 'Space') return 'Space';
  if (trimmed.length === 1) return trimmed.toUpperCase();
  return trimmed; // F1-F24, Escape, Tab, etc. already match Electron's naming
}

/**
 * Unregister all currently-registered global shortcuts.
 */
function unregisterAll(): void {
  for (const key of registeredKeys) {
    try {
      globalShortcut.unregister(key);
    } catch {
      // Already unregistered / invalid accelerator — ignore
    }
  }
  registeredKeys = [];
}

/**
 * Re-register global shortcuts from the given keybind map.
 * Replaces any previously registered shortcuts.
 */
function applyKeybinds(keybinds: Record<string, string> | undefined): void {
  unregisterAll();
  if (!keybinds) return;

  const next: string[] = [];
  for (const [key, presetId] of Object.entries(keybinds)) {
    const accelerator = toAccelerator(key);
    if (!accelerator || !presetId) continue;

    try {
      // Emit the key only — the server resolves the bound preset id from
      // config.keybinds[key] itself, same lookup the admin renderer's own
      // keydown handler relies on.
      const ok = globalShortcut.register(accelerator, () => {
        socket?.emit('keybind:execute', { key });
      });
      if (ok) next.push(accelerator);
      else console.warn(`[global-shortcuts] Failed to register "${accelerator}" (likely already claimed by another app)`);
    } catch (err) {
      console.warn(`[global-shortcuts] Invalid accelerator "${accelerator}":`, err);
    }
  }
  registeredKeys = next;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Connect to the embedded local server and start syncing global keybinds.
 * Safe to call once after the server has started. No-op if already
 * connected (call `stopGlobalShortcuts` first to reconnect).
 */
export function startGlobalShortcuts(): void {
  if (socket) return;

  socket = io(getServerBaseUrl(), {
    auth: { clientType: 'admin', token: getAdminToken() },
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  socket.on('connect', async () => {
    try {
      const res = await fetch(`${getServerBaseUrl()}/api/config`, {
        headers: { Authorization: `Bearer ${getAdminToken() ?? ''}` },
      });
      if (!res.ok) return;
      const config = await res.json() as AppConfig;
      applyKeybinds(config.keybinds);
    } catch (err) {
      console.warn('[global-shortcuts] Failed to fetch initial config:', err);
    }
  });

  socket.on('config:patch', (updates: Partial<AppConfig>) => {
    if (updates.keybinds) applyKeybinds(updates.keybinds);
  });

  socket.on('connect_error', (err: Error) => {
    console.warn('[global-shortcuts] Connection error:', err.message);
  });
}

/**
 * Disconnect from the server and unregister all global shortcuts.
 * Call this on app shutdown (before-quit) to release OS-level hotkey claims.
 */
export function stopGlobalShortcuts(): void {
  unregisterAll();
  socket?.disconnect();
  socket = null;
}
