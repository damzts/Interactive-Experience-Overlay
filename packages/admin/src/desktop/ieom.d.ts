/**
 * Type declarations for the `window.ieom` API exposed by the Electron preload script.
 * These types mirror the definitions in packages/desktop/src/preload/ieom.d.ts.
 *
 * The window.ieom API is only available when the admin UI runs inside the
 * Electron desktop shell. Use `isDesktopMode()` to check availability.
 */

export interface IeomLicenseApi {
  /** Request the current license tier from the main process. */
  getTier(): Promise<{ tier: string; expiresAt?: string }>
  /** Subscribe to license tier change events. Returns an unsubscribe function. */
  onTierChanged(callback: (data: { tier: string; expiresAt?: string }) => void): () => void
}

export interface IeomAuthApi {
  /** Initiate the OAuth login flow (opens system browser). */
  login(): Promise<void>
  /** Log out and clear the stored token. */
  logout(): Promise<void>
  /** Subscribe to auth status change events. Returns an unsubscribe function. */
  onStatusChanged(callback: (data: { authenticated: boolean; user?: object }) => void): () => void
}

export interface IeomServerApi {
  /** Subscribe to server status change events. Returns an unsubscribe function. */
  onStatusChanged(callback: (data: { running: boolean; error?: string }) => void): () => void
}

export interface IeomAppApi {
  /** Get the current application version. */
  getVersion(): Promise<string>
}

export interface IeomUpdateApi {
  /** Subscribe to update available notifications. Returns an unsubscribe function. */
  onAvailable(callback: (data: { version: string }) => void): () => void
  /** Accept and install the available update. */
  install(): Promise<void>
}

export interface IeomConnectivityApi {
  /** Subscribe to connectivity status change events. Returns an unsubscribe function. */
  onStatusChanged(callback: (data: { online: boolean }) => void): () => void
}

export interface IeomSettingsApi {
  /** Get the current launch-at-startup preference. */
  getLaunchAtStartup(): Promise<{ enabled: boolean }>
  /** Set the launch-at-startup preference. */
  setLaunchAtStartup(enabled: boolean): Promise<{ enabled: boolean }>
}

export interface IeomApi {
  license: IeomLicenseApi
  auth: IeomAuthApi
  server: IeomServerApi
  app: IeomAppApi
  update: IeomUpdateApi
  connectivity: IeomConnectivityApi
  settings: IeomSettingsApi
}

declare global {
  interface Window {
    ieom: IeomApi
  }
}
