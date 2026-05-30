/**
 * Deep link protocol handler for ieom:// URLs.
 * Handles OAuth callback tokens from the system browser.
 *
 * Parses incoming deep link URLs matching `ieom://auth?token=<value>`,
 * validates the token as a three-part JWT, and stores it via token-storage.
 */

import { app, Notification } from 'electron';
import { saveToken } from './token-storage.js';
import { broadcastAuthStatus } from './ipc-handlers.js';
import { validateLicense } from './license.js';

const PROTOCOL = 'ieom';

/**
 * Regex for a valid base64url segment: one or more alphanumeric, dash, or underscore characters.
 * No padding (`=`) is required.
 */
const BASE64URL_SEGMENT = /^[A-Za-z0-9_-]+$/;

/**
 * Validate whether a string has valid JWT format:
 * - Non-empty
 * - Three non-empty segments separated by dots
 * - Each segment is valid base64url (alphanumeric, `-`, `_`)
 */
export function isValidJwtFormat(token: string): boolean {
  if (!token) {
    return false;
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return false;
  }

  return parts.every((part) => part.length > 0 && BASE64URL_SEGMENT.test(part));
}

/**
 * Register the ieom:// protocol with the operating system.
 * Must be called before app 'ready' on some platforms.
 */
export function registerProtocolHandler(): void {
  if (process.defaultApp) {
    // In development, register with the path to the electron executable
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [process.argv[1]!]);
    }
  } else {
    app.setAsDefaultProtocolClient(PROTOCOL);
  }
}

/**
 * Handle an incoming deep link URL.
 * Parses the URL, validates the token, and stores it if valid.
 * On invalid/missing token, shows a native error notification.
 */
export function handleDeepLink(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    showAuthError();
    return;
  }

  // Only handle ieom://auth paths
  if (parsed.hostname !== 'auth' && parsed.pathname !== '//auth') {
    showAuthError();
    return;
  }

  const token = parsed.searchParams.get('token');

  if (!token || !isValidJwtFormat(token)) {
    showAuthError();
    return;
  }

  // Valid token — store it (replaces existing token if present)
  saveToken(token);

  // Decode JWT payload to extract user info (no verification — that's the backend's job)
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString());
    broadcastAuthStatus({
      authenticated: true,
      user: {
        id: payload.sub ?? payload.id ?? 'unknown',
        email: payload.email ?? '',
        name: payload.name ?? payload.email ?? 'User',
      },
    });
  } catch {
    // If decode fails, still broadcast authenticated (token is stored)
    broadcastAuthStatus({ authenticated: true });
  }

  // Re-validate license with the new token
  validateLicense();
}

/**
 * Display a native error notification indicating authentication failed.
 */
function showAuthError(): void {
  new Notification({
    title: 'IEOM',
    body: 'Authentication failed',
  }).show();
}
