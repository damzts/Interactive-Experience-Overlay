/**
 * Unit tests for the auto-updater module.
 * Tests: initAutoUpdater, checkForUpdates, installUpdate, retry logic,
 * IPC event emission, and native notification behavior.
 *
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockCheckForUpdates = vi.fn().mockResolvedValue(undefined);
const mockQuitAndInstall = vi.fn();
const autoUpdaterListeners: Record<string, ((...args: unknown[]) => void)[]> = {};

vi.mock('electron-updater', () => ({
  autoUpdater: {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    checkForUpdates: () => mockCheckForUpdates(),
    quitAndInstall: () => mockQuitAndInstall(),
    on: (event: string, handler: (...args: unknown[]) => void) => {
      if (!autoUpdaterListeners[event]) {
        autoUpdaterListeners[event] = [];
      }
      autoUpdaterListeners[event].push(handler);
    },
  },
}));

const mockNotificationShow = vi.fn();
vi.mock('electron', () => ({
  Notification: class MockNotification {
    title: string;
    body: string;
    constructor(opts: { title: string; body: string }) {
      this.title = opts.title;
      this.body = opts.body;
    }
    show = mockNotificationShow;
    static isSupported = vi.fn(() => true);
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
}));

vi.mock('../../main/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Import after mocks
const { initAutoUpdater, checkForUpdates, installUpdate, isUpdatePending, cleanupAutoUpdater } =
  await import('../../main/auto-updater.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emitAutoUpdaterEvent(event: string, ...args: unknown[]): void {
  const handlers = autoUpdaterListeners[event] || [];
  for (const handler of handlers) {
    handler(...args);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('auto-updater', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Clear listeners between tests
    for (const key of Object.keys(autoUpdaterListeners)) {
      delete autoUpdaterListeners[key];
    }

    // Re-initialize to register fresh listeners
    initAutoUpdater();
  });

  afterEach(() => {
    cleanupAutoUpdater();
    vi.useRealTimers();
  });

  describe('initAutoUpdater()', () => {
    it('should configure autoDownload to true', async () => {
      const { autoUpdater } = await import('electron-updater');
      expect(autoUpdater.autoDownload).toBe(true);
    });

    it('should configure autoInstallOnAppQuit to true', async () => {
      const { autoUpdater } = await import('electron-updater');
      expect(autoUpdater.autoInstallOnAppQuit).toBe(true);
    });

    it('should register event listeners for update lifecycle', () => {
      expect(autoUpdaterListeners['update-available']).toBeDefined();
      expect(autoUpdaterListeners['update-not-available']).toBeDefined();
      expect(autoUpdaterListeners['download-progress']).toBeDefined();
      expect(autoUpdaterListeners['update-downloaded']).toBeDefined();
      expect(autoUpdaterListeners['error']).toBeDefined();
    });
  });

  describe('checkForUpdates()', () => {
    it('should call autoUpdater.checkForUpdates()', () => {
      checkForUpdates();
      expect(mockCheckForUpdates).toHaveBeenCalled();
    });
  });

  describe('update-available event', () => {
    it('should emit update:available IPC to renderer with version info', async () => {
      const mockSend = vi.fn();
      const { BrowserWindow } = await import('electron');
      (BrowserWindow.getAllWindows as ReturnType<typeof vi.fn>).mockReturnValue([
        { isDestroyed: () => false, webContents: { send: mockSend } },
      ]);

      emitAutoUpdaterEvent('update-available', { version: '2.0.0' });

      expect(mockSend).toHaveBeenCalledWith('update:available', { version: '2.0.0' });
    });
  });

  describe('update-downloaded event', () => {
    it('should show a native notification when update is downloaded', () => {
      emitAutoUpdaterEvent('update-downloaded', { version: '2.0.0' });

      expect(mockNotificationShow).toHaveBeenCalled();
    });

    it('should mark update as pending after download', () => {
      emitAutoUpdaterEvent('update-downloaded', { version: '2.0.0' });

      expect(isUpdatePending()).toBe(true);
    });
  });

  describe('installUpdate()', () => {
    it('should call autoUpdater.quitAndInstall() when update is pending', () => {
      // Simulate a downloaded update
      emitAutoUpdaterEvent('update-downloaded', { version: '2.0.0' });

      installUpdate();

      expect(mockQuitAndInstall).toHaveBeenCalled();
    });

    it('should not call quitAndInstall if no update is pending', () => {
      // Don't emit update-downloaded — no pending update
      installUpdate();

      expect(mockQuitAndInstall).not.toHaveBeenCalled();
    });
  });

  describe('retry logic', () => {
    it('should retry after 5 minutes on first failure', () => {
      emitAutoUpdaterEvent('error', new Error('Download failed'));

      // Should not have retried yet
      expect(mockCheckForUpdates).not.toHaveBeenCalled();

      // Advance time by 5 minutes
      vi.advanceTimersByTime(5 * 60 * 1000);

      expect(mockCheckForUpdates).toHaveBeenCalled();
    });

    it('should retry up to 3 times on consecutive failures', () => {
      // First failure
      emitAutoUpdaterEvent('error', new Error('Fail 1'));
      vi.advanceTimersByTime(5 * 60 * 1000);
      expect(mockCheckForUpdates).toHaveBeenCalledTimes(1);

      // Second failure
      emitAutoUpdaterEvent('error', new Error('Fail 2'));
      vi.advanceTimersByTime(5 * 60 * 1000);
      expect(mockCheckForUpdates).toHaveBeenCalledTimes(2);

      // Third failure — should give up, no more retries
      emitAutoUpdaterEvent('error', new Error('Fail 3'));
      vi.advanceTimersByTime(5 * 60 * 1000);

      // Should NOT have been called a 3rd time (gave up after 3 failures)
      expect(mockCheckForUpdates).toHaveBeenCalledTimes(2);
    });

    it('should show notification on 3rd failure indicating max retries reached', () => {
      emitAutoUpdaterEvent('error', new Error('Fail 1'));
      vi.advanceTimersByTime(5 * 60 * 1000);

      emitAutoUpdaterEvent('error', new Error('Fail 2'));
      vi.advanceTimersByTime(5 * 60 * 1000);

      emitAutoUpdaterEvent('error', new Error('Fail 3'));

      expect(mockNotificationShow).toHaveBeenCalled();
    });

    it('should reset retry count after successful download', () => {
      // Fail once
      emitAutoUpdaterEvent('error', new Error('Fail 1'));
      vi.advanceTimersByTime(5 * 60 * 1000);

      // Successful download resets counter
      emitAutoUpdaterEvent('update-downloaded', { version: '2.0.0' });

      // Clear mocks to track new calls
      mockCheckForUpdates.mockClear();
      mockNotificationShow.mockClear();

      // Fail again — should retry (counter was reset)
      emitAutoUpdaterEvent('error', new Error('Fail after success'));
      vi.advanceTimersByTime(5 * 60 * 1000);

      expect(mockCheckForUpdates).toHaveBeenCalledTimes(1);
    });
  });

  describe('user dismisses notification', () => {
    it('should not force install — update re-checked on next app start', () => {
      emitAutoUpdaterEvent('update-downloaded', { version: '2.0.0' });

      // User dismisses notification — no action taken.
      // On next app start, checkForUpdates() is called again (tested via index.ts integration).
      // The auto-updater does NOT force install.
      expect(mockQuitAndInstall).not.toHaveBeenCalled();
    });
  });
});
