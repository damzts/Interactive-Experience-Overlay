/**
 * OAuth flow for desktop login.
 *
 * Opens an in-app BrowserWindow to the backend's /auth/google endpoint.
 * The backend handles OAuth with Google and eventually redirects with token.
 *
 * Flow:
 * 1. Open BrowserWindow â†’ GET /auth/google (backend)
 * 2. Backend redirects to Google OAuth consent
 * 3. User consents â†’ Google calls /auth/google/callback (backend)
 * 4. Backend redirects to frontend/callback with token
 * 5. Electron captures the URL, extracts the token
 * 6. Store token, broadcast auth status, validate license
 */

import { BrowserWindow } from 'electron';
import { saveToken } from './token-storage.js';
import { broadcastAuthStatus } from './ipc-handlers.js';
import { validateLicense } from './license.js';
import { getAuthBackendUrl } from './runtime-config.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

let authWindow: BrowserWindow | null = null;

/**
 * Start the OAuth login flow.
 * Opens an in-app window pointing to /auth/google.
 */
export async function startOAuthFlow(): Promise<void> {
  if (authWindow && !authWindow.isDestroyed()) {
    authWindow.focus();
    return;
  }

  authWindow = new BrowserWindow({
    width: 500,
    height: 700,
    show: true,
    autoHideMenuBar: true,
    title: 'IEOM - Sign in with Google',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const handleNavigation = (url: string): void => {
    const token = extractTokenFromUrl(url);
    if (!token) return;

    closeAuthWindow();
    void processToken(token);
  };

  authWindow.webContents.on('will-redirect', (_event, url) => {
    handleNavigation(url);
  });

  authWindow.webContents.on('will-navigate', (_event, url) => {
    handleNavigation(url);
  });

  authWindow.webContents.on('did-navigate', (_event, url) => {
    handleNavigation(url);
  });

  // If the final redirect URL cannot be loaded (e.g. frontend host down),
  // we still want to parse token/query params from that failing URL.
  authWindow.webContents.on('did-fail-load', (_event, _errorCode, _errorDescription, validatedURL) => {
    handleNavigation(validatedURL);
  });

  authWindow.on('closed', () => {
    authWindow = null;
  });

  await authWindow.loadURL(`${getAuthBackendUrl()}/auth/google?redirect=desktop`);
}

function closeAuthWindow(): void {
  if (authWindow && !authWindow.isDestroyed()) {
    authWindow.close();
  }
  authWindow = null;
}

function extractTokenFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    let token = parsed.searchParams.get('token') ?? parsed.searchParams.get('access_token');

    if (!token && parsed.hash) {
      const hashParams = new URLSearchParams(parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash);
      token = hashParams.get('token') ?? hashParams.get('access_token');
    }

    if (!token || !token.trim()) {
      return null;
    }

    return token.trim();
  } catch {
    return null;
  }
}

/**
 * Process a received JWT token: store it, broadcast auth, validate license.
 */
async function processToken(token: string): Promise<void> {
  // Store the token securely
  saveToken(token);

  // Decode JWT payload for user info (no verification â€” backend already verified)
  let user: object = { id: 'unknown', email: '', name: 'User' };
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString());
    user = {
      id: payload.userId ?? payload.sub ?? payload.id ?? 'unknown',
      email: payload.email ?? '',
      name: payload.name ?? payload.email ?? 'User',
    };
  } catch {
    // Use default user if decode fails
  }

  // Broadcast authenticated status to renderer
  broadcastAuthStatus({ authenticated: true, user });

  // Validate license with the new token
  await validateLicense();

  console.log('[oauth] Login successful');
}


