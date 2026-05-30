/**
 * Unit tests for the IPC handlers module.
 * Tests feature gating logic, IPC handler registration, and broadcast helpers.
 *
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 5.2, 5.7
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockHandle = vi.fn();
const mockOpenExternal = vi.fn().mockResolvedValue(undefined);
const mockGetVersion = vi.fn().mockReturnValue('1.2.3');
const mockSend = vi.fn();
const mockGetAllWindows = vi.fn().mockReturnValue([]);
const mockGetLicenseTier = vi.fn().mockReturnValue('free');
const mockValidateLicense = vi.fn().mockResolvedValue(undefined);
const mockClearToken = vi.fn();

vi.mock('electron', () => ({
  ipcMain: {
    handle: (...args: unknown[]) => mockHandle(...args),
  },
  app: {
    getVersion: () => mockGetVersion(),
  },
  shell: {
    openExternal: (...args: unknown[]) => mockOpenExternal(...args),
  },
  BrowserWindow: {
    getAllWindows: () => mockGetAllWindows(),
  },
}));

vi.mock('../../main/license.js', () => ({
  getLicenseTier: () => mockGetLicenseTier(),
  validateLicense: () => mockValidateLicense(),
}));

vi.mock('../../main/token-storage.js', () => ({
  clearToken: () => mockClearToken(),
}));

// Import after mocks
const ipcHandlers = await import('../../main/ipc-handlers.js');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ipc-handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isFeatureEnabled()', () => {
    it('should return false for stream-rooms on free tier', () => {
      expect(ipcHandlers.isFeatureEnabled('stream-rooms', 'free')).toBe(false);
    });

    it('should return false for stream-rooms on pro tier', () => {
      expect(ipcHandlers.isFeatureEnabled('stream-rooms', 'pro')).toBe(false);
    });

    it('should return true for stream-rooms on pro+rooms tier', () => {
      expect(ipcHandlers.isFeatureEnabled('stream-rooms', 'pro+rooms')).toBe(true);
    });

    it('should return false for advanced-ambiance-presets on free tier', () => {
      expect(ipcHandlers.isFeatureEnabled('advanced-ambiance-presets', 'free')).toBe(false);
    });

    it('should return true for advanced-ambiance-presets on pro tier', () => {
      expect(ipcHandlers.isFeatureEnabled('advanced-ambiance-presets', 'pro')).toBe(true);
    });

    it('should return true for advanced-ambiance-presets on pro+rooms tier', () => {
      expect(ipcHandlers.isFeatureEnabled('advanced-ambiance-presets', 'pro+rooms')).toBe(true);
    });

    it('should return false for priority-support on free tier', () => {
      expect(ipcHandlers.isFeatureEnabled('priority-support', 'free')).toBe(false);
    });

    it('should return true for priority-support on pro tier', () => {
      expect(ipcHandlers.isFeatureEnabled('priority-support', 'pro')).toBe(true);
    });

    it('should return true for unknown features (no gate)', () => {
      expect(ipcHandlers.isFeatureEnabled('unknown-feature', 'free')).toBe(true);
    });
  });

  describe('getRequiredTier()', () => {
    it('should return pro+rooms for stream-rooms', () => {
      expect(ipcHandlers.getRequiredTier('stream-rooms')).toBe('pro+rooms');
    });

    it('should return pro for advanced-ambiance-presets', () => {
      expect(ipcHandlers.getRequiredTier('advanced-ambiance-presets')).toBe('pro');
    });

    it('should return pro for priority-support', () => {
      expect(ipcHandlers.getRequiredTier('priority-support')).toBe('pro');
    });

    it('should return undefined for unknown features', () => {
      expect(ipcHandlers.getRequiredTier('unknown-feature')).toBeUndefined();
    });
  });

  describe('FEATURE_GATES', () => {
    it('should contain exactly three gated features', () => {
      expect(Object.keys(ipcHandlers.FEATURE_GATES)).toHaveLength(3);
    });

    it('should map stream-rooms to pro+rooms', () => {
      expect(ipcHandlers.FEATURE_GATES['stream-rooms']).toBe('pro+rooms');
    });

    it('should map advanced-ambiance-presets to pro', () => {
      expect(ipcHandlers.FEATURE_GATES['advanced-ambiance-presets']).toBe('pro');
    });

    it('should map priority-support to pro', () => {
      expect(ipcHandlers.FEATURE_GATES['priority-support']).toBe('pro');
    });
  });

  describe('registerIpcHandlers()', () => {
    beforeEach(() => {
      ipcHandlers.registerIpcHandlers();
    });

    it('should register license:get-tier handler', () => {
      expect(mockHandle).toHaveBeenCalledWith('license:get-tier', expect.any(Function));
    });

    it('should register auth:login handler', () => {
      expect(mockHandle).toHaveBeenCalledWith('auth:login', expect.any(Function));
    });

    it('should register auth:logout handler', () => {
      expect(mockHandle).toHaveBeenCalledWith('auth:logout', expect.any(Function));
    });

    it('should register app:get-version handler', () => {
      expect(mockHandle).toHaveBeenCalledWith('app:get-version', expect.any(Function));
    });

    it('should register update:install handler', () => {
      expect(mockHandle).toHaveBeenCalledWith('update:install', expect.any(Function));
    });

    it('license:get-tier handler should return current tier', () => {
      mockGetLicenseTier.mockReturnValue('pro');
      const handler = mockHandle.mock.calls.find(
        (call: unknown[]) => call[0] === 'license:get-tier',
      )![1] as () => { tier: string };

      const result = handler();
      expect(result).toEqual({ tier: 'pro' });
    });

    it('auth:login handler should open system browser to OAuth URL', async () => {
      const handler = mockHandle.mock.calls.find(
        (call: unknown[]) => call[0] === 'auth:login',
      )![1] as () => Promise<void>;

      await handler();
      expect(mockOpenExternal).toHaveBeenCalledWith(
        'https://app.ieom.gg/auth/google?redirect=ieom://auth',
      );
    });

    it('auth:logout handler should clear token and broadcast', () => {
      const mockWindow = { isDestroyed: () => false, webContents: { send: mockSend } };
      mockGetAllWindows.mockReturnValue([mockWindow]);

      const handler = mockHandle.mock.calls.find(
        (call: unknown[]) => call[0] === 'auth:logout',
      )![1] as () => void;

      handler();

      expect(mockClearToken).toHaveBeenCalled();
      expect(mockSend).toHaveBeenCalledWith('auth:status', { authenticated: false });
      expect(mockSend).toHaveBeenCalledWith('license:tier-changed', { tier: 'free' });
      expect(mockValidateLicense).toHaveBeenCalled();
    });

    it('app:get-version handler should return app version', () => {
      mockGetVersion.mockReturnValue('2.0.0');
      const handler = mockHandle.mock.calls.find(
        (call: unknown[]) => call[0] === 'app:get-version',
      )![1] as () => string;

      const result = handler();
      expect(result).toBe('2.0.0');
    });
  });

  describe('broadcastServerStatus()', () => {
    it('should send server:status to all windows', () => {
      const mockWindow = { isDestroyed: () => false, webContents: { send: mockSend } };
      mockGetAllWindows.mockReturnValue([mockWindow]);

      ipcHandlers.broadcastServerStatus({ running: true });

      expect(mockSend).toHaveBeenCalledWith('server:status', { running: true });
    });

    it('should send error info when server has error', () => {
      const mockWindow = { isDestroyed: () => false, webContents: { send: mockSend } };
      mockGetAllWindows.mockReturnValue([mockWindow]);

      ipcHandlers.broadcastServerStatus({ running: false, error: 'Port in use' });

      expect(mockSend).toHaveBeenCalledWith('server:status', {
        running: false,
        error: 'Port in use',
      });
    });

    it('should skip destroyed windows', () => {
      const destroyedWindow = { isDestroyed: () => true, webContents: { send: mockSend } };
      mockGetAllWindows.mockReturnValue([destroyedWindow]);

      ipcHandlers.broadcastServerStatus({ running: true });

      expect(mockSend).not.toHaveBeenCalled();
    });

    it('should broadcast to multiple windows', () => {
      const send1 = vi.fn();
      const send2 = vi.fn();
      const win1 = { isDestroyed: () => false, webContents: { send: send1 } };
      const win2 = { isDestroyed: () => false, webContents: { send: send2 } };
      mockGetAllWindows.mockReturnValue([win1, win2]);

      ipcHandlers.broadcastServerStatus({ running: true });

      expect(send1).toHaveBeenCalledWith('server:status', { running: true });
      expect(send2).toHaveBeenCalledWith('server:status', { running: true });
    });
  });

  describe('broadcastTierChanged()', () => {
    it('should send license:tier-changed to all windows', () => {
      const mockWindow = { isDestroyed: () => false, webContents: { send: mockSend } };
      mockGetAllWindows.mockReturnValue([mockWindow]);

      ipcHandlers.broadcastTierChanged('pro');

      expect(mockSend).toHaveBeenCalledWith('license:tier-changed', { tier: 'pro' });
    });

    it('should include expiresAt when provided', () => {
      const mockWindow = { isDestroyed: () => false, webContents: { send: mockSend } };
      mockGetAllWindows.mockReturnValue([mockWindow]);

      ipcHandlers.broadcastTierChanged('pro+rooms', '2025-12-31T00:00:00Z');

      expect(mockSend).toHaveBeenCalledWith('license:tier-changed', {
        tier: 'pro+rooms',
        expiresAt: '2025-12-31T00:00:00Z',
      });
    });
  });

  describe('broadcastAuthStatus()', () => {
    it('should send auth:status to all windows', () => {
      const mockWindow = { isDestroyed: () => false, webContents: { send: mockSend } };
      mockGetAllWindows.mockReturnValue([mockWindow]);

      ipcHandlers.broadcastAuthStatus({ authenticated: true, user: { name: 'Test' } });

      expect(mockSend).toHaveBeenCalledWith('auth:status', {
        authenticated: true,
        user: { name: 'Test' },
      });
    });

    it('should send unauthenticated status', () => {
      const mockWindow = { isDestroyed: () => false, webContents: { send: mockSend } };
      mockGetAllWindows.mockReturnValue([mockWindow]);

      ipcHandlers.broadcastAuthStatus({ authenticated: false });

      expect(mockSend).toHaveBeenCalledWith('auth:status', { authenticated: false });
    });
  });
});
