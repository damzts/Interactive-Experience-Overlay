/**
 * Property-based tests for Token Storage Round-Trip.
 *
 * Property 4: For any valid JWT token string, encrypting it via Safe Storage
 * and then decrypting the stored value SHALL produce the original token string unchanged.
 *
 * **Validates: Requirements 6.1, 6.3**
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// In-memory file store for mocking fs operations
// ---------------------------------------------------------------------------

const fileStore = new Map<string, Buffer | string>();

vi.mock('node:fs', () => ({
  existsSync: vi.fn((p: string) => fileStore.has(p)),
  readFileSync: vi.fn((p: string, encoding?: string) => {
    if (!fileStore.has(p)) {
      throw new Error(`ENOENT: no such file or directory, open '${p}'`);
    }
    const content = fileStore.get(p)!;
    if (encoding === 'utf-8') {
      return typeof content === 'string' ? content : content.toString('utf-8');
    }
    return typeof content === 'string' ? Buffer.from(content) : content;
  }),
  writeFileSync: vi.fn((p: string, data: Buffer | string) => {
    fileStore.set(p, data);
  }),
  unlinkSync: vi.fn((p: string) => {
    fileStore.delete(p);
  }),
}));

vi.mock('node:path', () => ({
  join: vi.fn((...parts: string[]) => parts.join('/')),
}));

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => {
      if (name === 'userData') return '/mock/userData';
      return '/mock/' + name;
    }),
  },
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: vi.fn((text: string) => Buffer.from(`enc:${text}`)),
    decryptString: vi.fn((buffer: Buffer) => buffer.toString().slice(4)), // remove 'enc:' prefix
  },
  Notification: vi.fn().mockImplementation(() => ({
    show: vi.fn(),
  })),
}));

import { Notification } from 'electron';
(Notification as unknown as { isSupported: () => boolean }).isSupported = () => true;

// Import after mocks are set up
const { saveToken, loadToken, clearToken } = await import('../../main/token-storage.js');

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

// Base64url alphabet: A-Z, a-z, 0-9, -, _
const BASE64URL_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/**
 * Arbitrary that generates a non-empty base64url segment.
 */
const base64urlSegment = fc.stringOf(
  fc.constantFrom(...BASE64URL_CHARS.split('')),
  { minLength: 1 }
);

/**
 * Arbitrary that generates a valid JWT-like string: three non-empty base64url
 * segments separated by dots (header.payload.signature).
 */
const validJwtToken = fc.tuple(base64urlSegment, base64urlSegment, base64urlSegment).map(
  ([header, payload, signature]) => `${header}.${payload}.${signature}`
);

// ---------------------------------------------------------------------------
// Property Tests
// ---------------------------------------------------------------------------

describe('Property 4: Token Storage Round-Trip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fileStore.clear();
  });

  it('for any valid JWT token, saveToken then loadToken returns the original token unchanged', () => {
    fc.assert(
      fc.property(validJwtToken, (token) => {
        // Clear state between iterations
        fileStore.clear();

        // Save the token (encrypts via safeStorage and writes to disk)
        saveToken(token);

        // Load the token (reads from disk and decrypts via safeStorage)
        const loaded = loadToken();

        // The round-trip must produce the original token unchanged
        expect(loaded).toBe(token);
      }),
      { numRuns: 100 }
    );
  });

  it('for any valid JWT token, clearToken then loadToken returns null', () => {
    fc.assert(
      fc.property(validJwtToken, (token) => {
        // Clear state between iterations
        fileStore.clear();

        // Save a token first
        saveToken(token);

        // Clear the token
        clearToken();

        // Load should return null after clearing
        const loaded = loadToken();
        expect(loaded).toBeNull();
      }),
      { numRuns: 100 }
    );
  });
});
