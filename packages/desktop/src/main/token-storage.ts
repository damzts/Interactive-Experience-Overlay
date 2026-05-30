/**
 * Secure token storage module.
 * Encrypts authentication tokens using Electron's safeStorage API
 * before persisting to disk. Implements a fallback chain:
 * safeStorage → plaintext with warning.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 5.7
 */

import { app, safeStorage, Notification } from 'electron';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// File paths
// ---------------------------------------------------------------------------

function getEncryptedTokenPath(): string {
  return join(app.getPath('userData'), 'auth-token.enc');
}

function getPlaintextTokenPath(): string {
  return join(app.getPath('userData'), 'auth-token.txt');
}

function getMetadataPath(): string {
  return join(app.getPath('userData'), 'auth-token.meta.json');
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

interface TokenMetadata {
  createdAt: string;
  encrypted: boolean;
}

function writeMetadata(encrypted: boolean): void {
  const metadata: TokenMetadata = {
    createdAt: new Date().toISOString(),
    encrypted,
  };
  writeFileSync(getMetadataPath(), JSON.stringify(metadata, null, 2), 'utf-8');
}

function deleteMetadata(): void {
  const metaPath = getMetadataPath();
  if (existsSync(metaPath)) {
    unlinkSync(metaPath);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Save a JWT token to disk.
 * Uses safeStorage encryption when available; falls back to plaintext with a warning.
 */
export function saveToken(jwt: string): void {
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(jwt);
    writeFileSync(getEncryptedTokenPath(), encrypted);
    writeMetadata(true);

    // Clean up any leftover plaintext file from a previous fallback
    const plaintextPath = getPlaintextTokenPath();
    if (existsSync(plaintextPath)) {
      unlinkSync(plaintextPath);
    }
  } else {
    // Fallback: plaintext with warning
    console.warn(
      '[token-storage] WARNING: safeStorage is unavailable. Token will be stored unencrypted.',
    );
    writeFileSync(getPlaintextTokenPath(), jwt, 'utf-8');
    writeMetadata(false);

    // Clean up any leftover encrypted file
    const encPath = getEncryptedTokenPath();
    if (existsSync(encPath)) {
      unlinkSync(encPath);
    }
  }
}

/**
 * Load the stored JWT token from disk.
 * Attempts to read the encrypted file first, then falls back to plaintext.
 * If decryption fails, deletes the corrupted file and notifies the user.
 * Returns null if no token is stored.
 */
export function loadToken(): string | null {
  const encPath = getEncryptedTokenPath();
  const plaintextPath = getPlaintextTokenPath();

  // Try encrypted file first
  if (existsSync(encPath)) {
    try {
      const buffer = readFileSync(encPath);
      const token = safeStorage.decryptString(buffer);
      return token;
    } catch {
      // Decryption failed — corrupted file or OS credential changes
      unlinkSync(encPath);
      deleteMetadata();

      // Notify user that re-authentication is required
      if (Notification.isSupported()) {
        const notification = new Notification({
          title: 'IEOM Authentication',
          body: 'Stored credentials could not be read. Please log in again.',
        });
        notification.show();
      }

      return null;
    }
  }

  // Fallback: try plaintext file
  if (existsSync(plaintextPath)) {
    try {
      const token = readFileSync(plaintextPath, 'utf-8');
      return token;
    } catch {
      // File exists but can't be read — clean up
      unlinkSync(plaintextPath);
      deleteMetadata();
      return null;
    }
  }

  // No token stored
  return null;
}

/**
 * Delete all stored token files (encrypted and plaintext).
 */
export function clearToken(): void {
  const encPath = getEncryptedTokenPath();
  const plaintextPath = getPlaintextTokenPath();

  if (existsSync(encPath)) {
    unlinkSync(encPath);
  }

  if (existsSync(plaintextPath)) {
    unlinkSync(plaintextPath);
  }

  deleteMetadata();
}

/**
 * Check whether a token file exists (encrypted or plaintext).
 */
export function hasToken(): boolean {
  return existsSync(getEncryptedTokenPath()) || existsSync(getPlaintextTokenPath());
}
