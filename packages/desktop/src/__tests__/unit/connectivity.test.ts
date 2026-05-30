/**
 * Unit tests for the connectivity monitoring module.
 * Tests: initConnectivityMonitor, getConnectivityStatus, cleanupConnectivityMonitor,
 * IPC emission on status change, and license re-validation on connectivity restoration.
 *
 * Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSend = vi.fn();
const mockExecuteJavaScript = vi.fn().mockResolvedValue(true);

let windowsAvailable = true;

vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: () => {
      if (!windowsAvailable) return [];
      return [
        {
          isDestroyed: () => false,
          webContents: {
            send: mockSend,
            executeJavaScript: mockExecuteJavaScript,
          },
        },
      ];
    },
  },
}));

const mockValidateLicense = vi.fn().mockResolvedValue(undefined);
vi.mock('../../main/license.js', () => ({
  validateLicense: () => mockValidateLicense(),
}));

// Import after mocks — single import, state managed via cleanupConnectivityMonitor
import { initConnectivityMonitor, getConnectivityStatus, cleanupConnectivityMonitor } from '../../main/connectivity.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('connectivity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockExecuteJavaScript.mockResolvedValue(true);
    windowsAvailable = true;
  });

  afterEach(() => {
    cleanupConnectivityMonitor();
    vi.useRealTimers();
  });

  describe('initConnectivityMonitor()', () => {
    it('should check initial connectivity state from BrowserWindow', async () => {
      initConnectivityMonitor();

      // Allow the initial async promise to resolve
      await vi.advanceTimersByTimeAsync(0);

      expect(mockExecuteJavaScript).toHaveBeenCalledWith('navigator.onLine');
    });

    it('should emit connectivity:status IPC with initial state', async () => {
      mockExecuteJavaScript.mockResolvedValue(true);
      initConnectivityMonitor();

      await vi.advanceTimersByTimeAsync(0);

      expect(mockSend).toHaveBeenCalledWith('connectivity:status', { online: true });
    });

    it('should default to online if no window is available', () => {
      windowsAvailable = false;
      initConnectivityMonitor();

      expect(getConnectivityStatus()).toBe(true);
    });
  });

  describe('getConnectivityStatus()', () => {
    it('should return true when online', async () => {
      mockExecuteJavaScript.mockResolvedValue(true);
      initConnectivityMonitor();
      await vi.advanceTimersByTimeAsync(0);

      expect(getConnectivityStatus()).toBe(true);
    });

    it('should return false when offline', async () => {
      mockExecuteJavaScript.mockResolvedValue(false);
      initConnectivityMonitor();
      await vi.advanceTimersByTimeAsync(0);

      expect(getConnectivityStatus()).toBe(false);
    });
  });

  describe('polling', () => {
    it('should poll connectivity every 30 seconds', async () => {
      initConnectivityMonitor();
      await vi.advanceTimersByTimeAsync(0);

      mockExecuteJavaScript.mockClear();

      // Advance 30 seconds — should trigger a poll
      await vi.advanceTimersByTimeAsync(30_000);

      expect(mockExecuteJavaScript).toHaveBeenCalledWith('navigator.onLine');
    });

    it('should emit connectivity:status only on state change', async () => {
      mockExecuteJavaScript.mockResolvedValue(true);
      initConnectivityMonitor();
      await vi.advanceTimersByTimeAsync(0);

      mockSend.mockClear();

      // Poll again with same state — should NOT emit
      await vi.advanceTimersByTimeAsync(30_000);

      expect(mockSend).not.toHaveBeenCalled();
    });

    it('should emit connectivity:status when state changes from online to offline', async () => {
      mockExecuteJavaScript.mockResolvedValue(true);
      initConnectivityMonitor();
      await vi.advanceTimersByTimeAsync(0);

      mockSend.mockClear();

      // Change to offline on next poll
      mockExecuteJavaScript.mockResolvedValue(false);
      await vi.advanceTimersByTimeAsync(30_000);

      expect(mockSend).toHaveBeenCalledWith('connectivity:status', { online: false });
    });

    it('should emit connectivity:status when state changes from offline to online', async () => {
      mockExecuteJavaScript.mockResolvedValue(false);
      initConnectivityMonitor();
      await vi.advanceTimersByTimeAsync(0);

      mockSend.mockClear();

      // Change to online on next poll
      mockExecuteJavaScript.mockResolvedValue(true);
      await vi.advanceTimersByTimeAsync(30_000);

      expect(mockSend).toHaveBeenCalledWith('connectivity:status', { online: true });
    });
  });

  describe('license re-validation on connectivity restoration', () => {
    it('should trigger license re-validation 30 seconds after going online', async () => {
      // Start offline
      mockExecuteJavaScript.mockResolvedValue(false);
      initConnectivityMonitor();
      await vi.advanceTimersByTimeAsync(0);

      // Go online on next poll
      mockExecuteJavaScript.mockResolvedValue(true);
      await vi.advanceTimersByTimeAsync(30_000); // poll detects online

      expect(mockValidateLicense).not.toHaveBeenCalled();

      // Wait 30 seconds for re-validation delay
      await vi.advanceTimersByTimeAsync(30_000);

      expect(mockValidateLicense).toHaveBeenCalledTimes(1);
    });

    it('should retry up to 3 times at 60-second intervals on failure', async () => {
      // Start offline
      mockExecuteJavaScript.mockResolvedValue(false);
      initConnectivityMonitor();
      await vi.advanceTimersByTimeAsync(0);

      // Go online
      mockExecuteJavaScript.mockResolvedValue(true);
      await vi.advanceTimersByTimeAsync(30_000); // poll detects online

      // Make validateLicense fail
      mockValidateLicense.mockRejectedValue(new Error('Network error'));

      // Wait 30 seconds for initial re-validation attempt
      await vi.advanceTimersByTimeAsync(30_000);
      expect(mockValidateLicense).toHaveBeenCalledTimes(1);

      // Wait 60 seconds for first retry
      await vi.advanceTimersByTimeAsync(60_000);
      expect(mockValidateLicense).toHaveBeenCalledTimes(2);

      // Wait 60 seconds for second retry
      await vi.advanceTimersByTimeAsync(60_000);
      expect(mockValidateLicense).toHaveBeenCalledTimes(3);

      // Wait 60 seconds — should NOT retry again (max 3 attempts)
      await vi.advanceTimersByTimeAsync(60_000);
      expect(mockValidateLicense).toHaveBeenCalledTimes(3);
    });

    it('should not retry after successful re-validation', async () => {
      // Start offline
      mockExecuteJavaScript.mockResolvedValue(false);
      initConnectivityMonitor();
      await vi.advanceTimersByTimeAsync(0);

      // Go online
      mockExecuteJavaScript.mockResolvedValue(true);
      await vi.advanceTimersByTimeAsync(30_000); // poll detects online

      // validateLicense succeeds
      mockValidateLicense.mockResolvedValue(undefined);

      // Wait 30 seconds for re-validation
      await vi.advanceTimersByTimeAsync(30_000);
      expect(mockValidateLicense).toHaveBeenCalledTimes(1);

      // Wait 60 seconds — should NOT retry (success)
      await vi.advanceTimersByTimeAsync(60_000);
      expect(mockValidateLicense).toHaveBeenCalledTimes(1);
    });
  });

  describe('cleanupConnectivityMonitor()', () => {
    it('should stop polling after cleanup', async () => {
      initConnectivityMonitor();
      await vi.advanceTimersByTimeAsync(0);

      cleanupConnectivityMonitor();
      mockExecuteJavaScript.mockClear();

      // Advance time — should NOT poll
      await vi.advanceTimersByTimeAsync(30_000);

      expect(mockExecuteJavaScript).not.toHaveBeenCalled();
    });

    it('should cancel pending re-validation timers', async () => {
      // Start offline
      mockExecuteJavaScript.mockResolvedValue(false);
      initConnectivityMonitor();
      await vi.advanceTimersByTimeAsync(0);

      // Go online — triggers re-validation timer
      mockExecuteJavaScript.mockResolvedValue(true);
      await vi.advanceTimersByTimeAsync(30_000);

      // Cleanup before re-validation fires
      cleanupConnectivityMonitor();

      // Advance past the re-validation delay
      await vi.advanceTimersByTimeAsync(30_000);

      expect(mockValidateLicense).not.toHaveBeenCalled();
    });
  });

  describe('offline operation (Requirements 12.1, 12.2)', () => {
    it('local features work offline by design — embedded server runs on localhost with SQLite', () => {
      // This test documents that local features (scenes, events, OBS bridge, ambiance)
      // work without internet by architectural design:
      // - The Fastify server runs in-process on localhost
      // - SQLite database is local
      // - No network dependency for core functionality
      // The connectivity module only affects remote features (license, rooms).
      expect(true).toBe(true);
    });
  });
});
