/**
 * Unit tests for the token storage module.
 * Tests saveToken, loadToken, clearToken, hasToken with mocked Electron APIs.
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 5.7
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockNotificationShow = vi.fn();
let mockEncryptionAvailable = true;

// Track which files "exist" and their contents
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
    isEncryptionAvailable: vi.fn(() => mockEncryptionAvailable),
    encryptString: vi.fn((text: string) => Buffer.from(`encrypted:${text}`)),
    decryptString: vi.fn((buffer: Buffer) => {
      const str = buffer.toString();
      if (!str.startsWith('encrypted:')) {
        throw new Error('Decryption failed');
      }
      return str.slice('encrypted:'.length);
    }),
  },
  Notification: vi.fn().mockImplementation(() => ({
    show: mockNotificationShow,
  })),
}));

// Make Notification.isSupported a static method
import { Notification } from 'electron';
(Notification as unknown as { isSupported: () => boolean }).isSupported = () => true;

// Import after mocks
const tokenStorage = await import('../../main/token-storage.js');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ENC_PATH = '/mock/userData/auth-token.enc';
const TXT_PATH = '/mock/userData/auth-token.txt';
const META_PATH = '/mock/userData/auth-token.meta.json';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('token-storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fileStore.clear();
    mockEncryptionAvailable = true;
  });

  describe('saveToken()', () => {
    it('should encrypt and write token when safeStorage is available', () => {
      tokenStorage.saveToken('header.payload.signature');

      // Should have written encrypted token
      expect(fileStore.get(ENC_PATH)).toEqual(
        Buffer.from('encrypted:header.payload.signature'),
      );
      // Should have written metadata
      const metaRaw = fileStore.get(META_PATH);
      expect(metaRaw).toBeDefined();
      const meta = JSON.parse(metaRaw as string);
      expect(meta.encrypted).toBe(true);
      expect(meta.createdAt).toBeDefined();
    });

    it('should store plaintext with warning when safeStorage is unavailable', () => {
      mockEncryptionAvailable = false;
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      tokenStorage.saveToken('header.payload.signature');

      expect(fileStore.get(TXT_PATH)).toBe('header.payload.signature');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('safeStorage is unavailable'),
      );

      const meta = JSON.parse(fileStore.get(META_PATH) as string);
      expect(meta.encrypted).toBe(false);

      warnSpy.mockRestore();
    });

    it('should clean up plaintext file when saving encrypted', () => {
      // Pre-existing plaintext file
      fileStore.set(TXT_PATH, 'old-token');

      tokenStorage.saveToken('new-token');

      expect(fileStore.has(TXT_PATH)).toBe(false);
      expect(fileStore.has(ENC_PATH)).toBe(true);
    });

    it('should clean up encrypted file when saving plaintext', () => {
      mockEncryptionAvailable = false;
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      // Pre-existing encrypted file
      fileStore.set(ENC_PATH, Buffer.from('encrypted:old'));

      tokenStorage.saveToken('new-token');

      expect(fileStore.has(ENC_PATH)).toBe(false);
      expect(fileStore.get(TXT_PATH)).toBe('new-token');
    });

    it('should write metadata with creation timestamp', () => {
      tokenStorage.saveToken('test.jwt.token');

      const metaRaw = fileStore.get(META_PATH);
      expect(metaRaw).toBeDefined();
      const meta = JSON.parse(metaRaw as string);
      expect(meta.createdAt).toBeDefined();
      // Should be a valid ISO date
      expect(new Date(meta.createdAt).toISOString()).toBe(meta.createdAt);
    });
  });

  describe('loadToken()', () => {
    it('should decrypt and return token from encrypted file', () => {
      fileStore.set(ENC_PATH, Buffer.from('encrypted:my.jwt.token'));

      const token = tokenStorage.loadToken();

      expect(token).toBe('my.jwt.token');
    });

    it('should return token from plaintext file when no encrypted file exists', () => {
      fileStore.set(TXT_PATH, 'plaintext.jwt.token');

      const token = tokenStorage.loadToken();

      expect(token).toBe('plaintext.jwt.token');
    });

    it('should return null when no token files exist', () => {
      const token = tokenStorage.loadToken();

      expect(token).toBeNull();
    });

    it('should delete corrupted encrypted file and show notification on decryption failure', () => {
      fileStore.set(ENC_PATH, Buffer.from('corrupted-data'));

      const token = tokenStorage.loadToken();

      expect(token).toBeNull();
      expect(fileStore.has(ENC_PATH)).toBe(false);
      expect(mockNotificationShow).toHaveBeenCalled();
    });

    it('should delete metadata when decryption fails', () => {
      fileStore.set(ENC_PATH, Buffer.from('corrupted-data'));
      fileStore.set(META_PATH, '{}');

      tokenStorage.loadToken();

      expect(fileStore.has(META_PATH)).toBe(false);
    });
  });

  describe('clearToken()', () => {
    it('should delete encrypted token file and metadata', () => {
      fileStore.set(ENC_PATH, Buffer.from('encrypted:token'));
      fileStore.set(META_PATH, '{}');

      tokenStorage.clearToken();

      expect(fileStore.has(ENC_PATH)).toBe(false);
      expect(fileStore.has(META_PATH)).toBe(false);
    });

    it('should delete plaintext token file and metadata', () => {
      fileStore.set(TXT_PATH, 'token');
      fileStore.set(META_PATH, '{}');

      tokenStorage.clearToken();

      expect(fileStore.has(TXT_PATH)).toBe(false);
      expect(fileStore.has(META_PATH)).toBe(false);
    });

    it('should delete both files if both exist', () => {
      fileStore.set(ENC_PATH, Buffer.from('encrypted:token'));
      fileStore.set(TXT_PATH, 'token');
      fileStore.set(META_PATH, '{}');

      tokenStorage.clearToken();

      expect(fileStore.has(ENC_PATH)).toBe(false);
      expect(fileStore.has(TXT_PATH)).toBe(false);
      expect(fileStore.has(META_PATH)).toBe(false);
    });

    it('should not throw when no token files exist', () => {
      expect(() => tokenStorage.clearToken()).not.toThrow();
    });
  });

  describe('hasToken()', () => {
    it('should return true when encrypted token exists', () => {
      fileStore.set(ENC_PATH, Buffer.from('encrypted:token'));

      expect(tokenStorage.hasToken()).toBe(true);
    });

    it('should return true when plaintext token exists', () => {
      fileStore.set(TXT_PATH, 'token');

      expect(tokenStorage.hasToken()).toBe(true);
    });

    it('should return false when no token files exist', () => {
      expect(tokenStorage.hasToken()).toBe(false);
    });
  });
});
