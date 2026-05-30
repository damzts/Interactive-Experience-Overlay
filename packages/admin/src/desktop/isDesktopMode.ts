/**
 * Detects whether the admin UI is running inside the Electron desktop shell.
 * Desktop mode is identified by the presence of the `window.ieom` API
 * injected by the preload script via contextBridge.
 */
export function isDesktopMode(): boolean {
  return typeof window !== 'undefined' && 'ieom' in window
}
