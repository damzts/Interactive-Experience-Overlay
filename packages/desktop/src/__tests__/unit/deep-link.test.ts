/**
 * Unit tests for the deep link protocol handler.
 * Tests: isValidJwtFormat, handleDeepLink URL parsing, token storage, error notification.
 *
 * Validates: Requirements 5.1, 5.4, 5.5, 5.6, 5.8
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockShow = vi.fn();

vi.mock('electron', () => ({
  app: {
    setAsDefaultProtocolClient: vi.fn(),
    getPath: vi.fn(() => '/mock/userData'),
    getVersion: vi.fn(() => '1.0.0'),
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
  Notification: class MockNotification {
    title: string;
    body: string;
    constructor(opts: { title: string; body: string }) {
      this.title = opts.title;
      this.body = opts.body;
    }
    show = mockShow;
  },
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: vi.fn((s: string) => Buffer.from(s)),
    decryptString: vi.fn((b: Buffer) => b.toString()),
  },
}));

const mockSaveToken = vi.fn();
vi.mock('../../main/token-storage.js', () => ({
  saveToken: (...args: unknown[]) => mockSaveToken(...args),
}));

// Import after mocks
const { isValidJwtFormat, handleDeepLink, registerProtocolHandler } = await import(
  '../../main/deeplink.js'
);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('isValidJwtFormat', () => {
  it('should return true for a valid three-part JWT', () => {
    const token = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
    expect(isValidJwtFormat(token)).toBe(true);
  });

  it('should return true for minimal valid segments', () => {
    expect(isValidJwtFormat('a.b.c')).toBe(true);
  });

  it('should return true for base64url characters including dash and underscore', () => {
    expect(isValidJwtFormat('abc-def_ghi.jkl-mno_pqr.stu-vwx_yz0')).toBe(true);
  });

  it('should return false for empty string', () => {
    expect(isValidJwtFormat('')).toBe(false);
  });

  it('should return false for a single segment (no dots)', () => {
    expect(isValidJwtFormat('abcdef')).toBe(false);
  });

  it('should return false for two segments', () => {
    expect(isValidJwtFormat('abc.def')).toBe(false);
  });

  it('should return false for four segments', () => {
    expect(isValidJwtFormat('a.b.c.d')).toBe(false);
  });

  it('should return false when a segment is empty', () => {
    expect(isValidJwtFormat('.b.c')).toBe(false);
    expect(isValidJwtFormat('a..c')).toBe(false);
    expect(isValidJwtFormat('a.b.')).toBe(false);
  });

  it('should return false for segments with invalid characters (padding =)', () => {
    expect(isValidJwtFormat('abc=.def.ghi')).toBe(false);
  });

  it('should return false for segments with spaces', () => {
    expect(isValidJwtFormat('ab c.def.ghi')).toBe(false);
  });

  it('should return false for segments with plus sign (base64 but not base64url)', () => {
    expect(isValidJwtFormat('ab+c.def.ghi')).toBe(false);
  });

  it('should return false for segments with slash (base64 but not base64url)', () => {
    expect(isValidJwtFormat('ab/c.def.ghi')).toBe(false);
  });
});

describe('handleDeepLink', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should store a valid token from ieom://auth?token=<jwt>', () => {
    const token = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.rSWamyAYwuHCo7IFAgd1oRpSP7nzL7BF5t7ItqpKViM';
    handleDeepLink(`ieom://auth?token=${token}`);

    expect(mockSaveToken).toHaveBeenCalledWith(token);
    expect(mockShow).not.toHaveBeenCalled();
  });

  it('should replace existing token when a new valid token arrives', () => {
    const token1 = 'aaa.bbb.ccc';
    const token2 = 'xxx.yyy.zzz';

    handleDeepLink(`ieom://auth?token=${token1}`);
    handleDeepLink(`ieom://auth?token=${token2}`);

    expect(mockSaveToken).toHaveBeenCalledTimes(2);
    expect(mockSaveToken).toHaveBeenLastCalledWith(token2);
  });

  it('should show error notification when token is missing', () => {
    handleDeepLink('ieom://auth');

    expect(mockSaveToken).not.toHaveBeenCalled();
    expect(mockShow).toHaveBeenCalled();
  });

  it('should show error notification when token is empty', () => {
    handleDeepLink('ieom://auth?token=');

    expect(mockSaveToken).not.toHaveBeenCalled();
    expect(mockShow).toHaveBeenCalled();
  });

  it('should show error notification when token is not a valid JWT format', () => {
    handleDeepLink('ieom://auth?token=not-a-jwt');

    expect(mockSaveToken).not.toHaveBeenCalled();
    expect(mockShow).toHaveBeenCalled();
  });

  it('should show error notification for a malformed URL', () => {
    handleDeepLink('not a url at all');

    expect(mockSaveToken).not.toHaveBeenCalled();
    expect(mockShow).toHaveBeenCalled();
  });

  it('should show error notification for a non-auth deep link path', () => {
    handleDeepLink('ieom://other?token=a.b.c');

    expect(mockSaveToken).not.toHaveBeenCalled();
    expect(mockShow).toHaveBeenCalled();
  });

  it('should handle URL-encoded token values', () => {
    // base64url tokens shouldn't need encoding, but test robustness
    const token = 'abc-def.ghi_jkl.mno-pqr';
    handleDeepLink(`ieom://auth?token=${token}`);

    expect(mockSaveToken).toHaveBeenCalledWith(token);
  });
});

describe('registerProtocolHandler', () => {
  it('should call app.setAsDefaultProtocolClient', async () => {
    const electron = await import('electron');
    registerProtocolHandler();

    expect(electron.app.setAsDefaultProtocolClient).toHaveBeenCalled();
  });
});
