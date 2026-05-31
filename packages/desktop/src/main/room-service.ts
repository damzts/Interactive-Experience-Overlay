/**
 * Room service — delegates room management to the local @ieom/server.
 * The server holds all WebRTC connections; the desktop app just tells it
 * when to join/leave rooms via HTTP API.
 */

import { BrowserWindow, Notification } from 'electron';
import { loadToken } from './token-storage.js';
import { getDesktopServerPort } from './runtime-config.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RoomStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface RoomState {
  status: RoomStatus;
  roomId: string | null;
  participants: string[];
  error?: string;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let currentState: RoomState = { status: 'disconnected', roomId: null, participants: [] };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getServerBaseUrl(): string {
  return `http://127.0.0.1:${getDesktopServerPort()}`;
}

function emitToWindows(channel: string, data: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, data);
    }
  }
}

function updateState(patch: Partial<RoomState>): void {
  currentState = { ...currentState, ...patch };
  emitToWindows('room:status', currentState);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Join a cloud room. Tells the local server to connect to the cloud
 * signaling relay as the hub for the given room.
 */
export async function joinRoom(roomId: string, cloudUrl: string): Promise<void> {
  const token = loadToken();
  if (!token) {
    updateState({ status: 'error', error: 'No authentication token' });
    if (Notification.isSupported()) {
      new Notification({ title: 'IEOM Room', body: 'Please log in before joining a room.' }).show();
    }
    return;
  }

  updateState({ status: 'connecting', roomId });

  try {
    const res = await fetch(`${getServerBaseUrl()}/api/room/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cloudUrl, token, roomId }),
    });

    const data = await res.json() as { ok: boolean; error?: string };
    if (!data.ok) throw new Error(data.error || 'Failed to join room');

    updateState({ status: 'connected', roomId });
  } catch (e: any) {
    updateState({ status: 'error', roomId: null, error: e.message });
  }
}

/**
 * Leave the current room.
 */
export async function leaveRoom(): Promise<void> {
  try {
    await fetch(`${getServerBaseUrl()}/api/room/leave`, { method: 'POST' });
  } catch {
    // Ignore errors during leave
  }
  updateState({ status: 'disconnected', roomId: null, participants: [] });
}

/**
 * Get the current room status from the server.
 */
export async function refreshRoomStatus(): Promise<RoomState> {
  try {
    const res = await fetch(`${getServerBaseUrl()}/api/room/status`);
    const data = await res.json() as { connected: boolean; roomId: string | null; participants: string[] };
    currentState = {
      status: data.connected ? 'connected' : 'disconnected',
      roomId: data.roomId,
      participants: data.participants ?? [],
    };
  } catch {
    // Server not reachable
  }
  return currentState;
}

/**
 * Get the current room state (cached).
 */
export function getRoomStatus(): RoomState {
  return currentState;
}
