import { contextBridge, ipcRenderer } from 'electron';

/**
 * Preload script for the Admin Window.
 * Exposes a typed `window.ieom` API via contextBridge,
 * bridging IPC communication between the renderer and main process.
 */

const api = {
  license: {
    /** Request the current license tier from the main process. */
    getTier(): Promise<{ tier: string; expiresAt?: string }> {
      return ipcRenderer.invoke('license:get-tier');
    },
    /** Subscribe to license tier change events from the main process. Returns an unsubscribe function. */
    onTierChanged(callback: (data: { tier: string; expiresAt?: string }) => void): () => void {
      const listener = (_event: Electron.IpcRendererEvent, data: { tier: string; expiresAt?: string }) => {
        callback(data);
      };
      ipcRenderer.on('license:tier-changed', listener);
      return () => {
        ipcRenderer.removeListener('license:tier-changed', listener);
      };
    },
  },

  auth: {
    /** Initiate the OAuth login flow (opens system browser). */
    login(): Promise<void> {
      return ipcRenderer.invoke('auth:login');
    },
    /** Log out and clear the stored token. */
    logout(): Promise<void> {
      return ipcRenderer.invoke('auth:logout');
    },
    /** Subscribe to auth status change events. Returns an unsubscribe function. */
    onStatusChanged(callback: (data: { authenticated: boolean; user?: object }) => void): () => void {
      const listener = (_event: Electron.IpcRendererEvent, data: { authenticated: boolean; user?: object }) => {
        callback(data);
      };
      ipcRenderer.on('auth:status', listener);
      return () => {
        ipcRenderer.removeListener('auth:status', listener);
      };
    },
  },

  server: {
    /** Request the admin token from the main process (never exposed in URL). */
    getAdminToken(): Promise<string | null> {
      return ipcRenderer.invoke('server:get-admin-token');
    },
    /** Subscribe to server status change events. Returns an unsubscribe function. */
    onStatusChanged(callback: (data: { running: boolean; error?: string }) => void): () => void {
      const listener = (_event: Electron.IpcRendererEvent, data: { running: boolean; error?: string }) => {
        callback(data);
      };
      ipcRenderer.on('server:status', listener);
      return () => {
        ipcRenderer.removeListener('server:status', listener);
      };
    },
  },

  app: {
    /** Get the current application version. */
    getVersion(): Promise<string> {
      return ipcRenderer.invoke('app:get-version');
    },
  },

  update: {
    /** Subscribe to update available notifications. Returns an unsubscribe function. */
    onAvailable(callback: (data: { version: string }) => void): () => void {
      const listener = (_event: Electron.IpcRendererEvent, data: { version: string }) => {
        callback(data);
      };
      ipcRenderer.on('update:available', listener);
      return () => {
        ipcRenderer.removeListener('update:available', listener);
      };
    },
    /** Accept and install the available update. */
    install(): Promise<void> {
      return ipcRenderer.invoke('update:install');
    },
  },

  connectivity: {
    /** Subscribe to connectivity status change events. Returns an unsubscribe function. */
    onStatusChanged(callback: (data: { online: boolean }) => void): () => void {
      const listener = (_event: Electron.IpcRendererEvent, data: { online: boolean }) => {
        callback(data);
      };
      ipcRenderer.on('connectivity:status', listener);
      return () => {
        ipcRenderer.removeListener('connectivity:status', listener);
      };
    },
  },

  settings: {
    /** Get the current launch-at-startup preference. */
    getLaunchAtStartup(): Promise<{ enabled: boolean }> {
      return ipcRenderer.invoke('startup:get-launch-at-startup');
    },
    /** Set the launch-at-startup preference. */
    setLaunchAtStartup(enabled: boolean): Promise<{ enabled: boolean }> {
      return ipcRenderer.invoke('startup:set-launch-at-startup', enabled);
    },
  },

  room: {
    /** Join a cloud room as the hub. */
    join(roomId: string, cloudUrl: string): Promise<{ status: string; roomId: string | null }> {
      return ipcRenderer.invoke('room:join', roomId, cloudUrl);
    },
    /** Leave the current room. */
    leave(): Promise<{ status: string; roomId: string | null }> {
      return ipcRenderer.invoke('room:leave');
    },
    /** Get current room status. */
    getStatus(): Promise<{ status: string; roomId: string | null; participants: string[] }> {
      return ipcRenderer.invoke('room:status');
    },
    /** Subscribe to room status changes. Returns an unsubscribe function. */
    onStatus(callback: (data: { status: string; roomId: string | null; participants: string[] }) => void): () => void {
      const listener = (_event: Electron.IpcRendererEvent, data: any) => callback(data);
      ipcRenderer.on('room:status', listener);
      return () => { ipcRenderer.removeListener('room:status', listener); };
    },
  },
} as const;

contextBridge.exposeInMainWorld('ieom', api);
