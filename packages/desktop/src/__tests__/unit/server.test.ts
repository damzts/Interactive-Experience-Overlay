/**
 * Unit tests for the embedded server lifecycle manager.
 * Tests core logic: startServer, stopServer, restartServer, getServerStatus.
 *
 * Validates: Requirements 1.1, 1.2, 1.5, 1.7, 2.1, 2.4, 2.6, 3.6, 3.7
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockStart = vi.fn();
const mockStop = vi.fn();
const mockGetPort = vi.fn(() => 3000);

vi.mock('@ieom/server/desktop-entry', () => ({
  createDesktopServer: vi.fn(async () => ({
    app: {},
    io: {},
    start: mockStart,
    stop: mockStop,
    getPort: mockGetPort,
  })),
}));

const mockShowMessageBox = vi.fn();
const mockQuit = vi.fn();
const mockGetPath = vi.fn(() => '/mock/userData');
const mockGetAppPath = vi.fn(() => '/mock/app');
const mockNotificationShow = vi.fn();
const mockWebContentsSend = vi.fn();

vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => mockGetPath(name),
    getAppPath: () => mockGetAppPath(),
    isPackaged: false,
    quit: () => mockQuit(),
  },
  dialog: {
    showMessageBox: (...args: unknown[]) => mockShowMessageBox(...args),
  },
  Notification: class MockNotification {
    static isSupported() { return true; }
    constructor(_opts: unknown) {}
    show() { mockNotificationShow(); }
  },
  BrowserWindow: {
    getAllWindows: () => [{
      isDestroyed: () => false,
      webContents: { send: mockWebContentsSend },
    }],
  },
}));

// Import after mocks are set up
const { startServer, stopServer, restartServer, getServerStatus } = await import('../../main/server.js');
const { createDesktopServer } = await import('@ieom/server/desktop-entry');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('server lifecycle manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStart.mockResolvedValue(undefined);
    mockStop.mockResolvedValue(undefined);
  });

  describe('startServer()', () => {
    it('should start the server and emit running status', async () => {
      await startServer();

      expect(createDesktopServer).toHaveBeenCalledWith(
        expect.objectContaining({
          dbPath: expect.stringContaining('ieom.db'),
          port: 3000,
          assetsDir: expect.any(String),
          overlayDir: expect.any(String),
          adminDir: expect.any(String),
        })
      );
      expect(mockStart).toHaveBeenCalled();
      expect(mockWebContentsSend).toHaveBeenCalledWith('server:status', { running: true });
    });

    it('should show error dialog and quit on port-in-use error', async () => {
      const portError = new Error('listen EADDRINUSE: address already in use 127.0.0.1:3000');
      (portError as NodeJS.ErrnoException).code = 'EADDRINUSE';
      mockStart.mockRejectedValueOnce(portError);
      mockShowMessageBox.mockResolvedValueOnce({ response: 1 }); // Quit

      await startServer();

      expect(mockShowMessageBox).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Port 3000 is already in use'),
          buttons: ['Retry', 'Quit'],
        })
      );
      expect(mockQuit).toHaveBeenCalled();
    });

    it('should retry on port-in-use when user selects Retry', async () => {
      const portError = new Error('listen EADDRINUSE');
      (portError as NodeJS.ErrnoException).code = 'EADDRINUSE';
      mockStart.mockRejectedValueOnce(portError);
      mockShowMessageBox.mockResolvedValueOnce({ response: 0 }); // Retry
      // Second attempt succeeds
      mockStart.mockResolvedValueOnce(undefined);

      await startServer();

      expect(mockShowMessageBox).toHaveBeenCalledTimes(1);
      expect(mockStart).toHaveBeenCalledTimes(2);
    });

    it('should show database error dialog and quit', async () => {
      const dbError = new Error('SQLite database is corrupted');
      mockStart.mockRejectedValueOnce(dbError);
      mockShowMessageBox.mockResolvedValueOnce({ response: 0 }); // Quit (only option)

      await startServer();

      expect(mockShowMessageBox).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Database error',
          buttons: ['Quit'],
        })
      );
      expect(mockQuit).toHaveBeenCalled();
    });

    it('should show timeout error dialog with Retry/Quit options', async () => {
      // Simulate a start that never resolves (will timeout)
      mockStart.mockImplementationOnce(() => new Promise(() => {}));
      mockShowMessageBox.mockResolvedValueOnce({ response: 1 }); // Quit

      await startServer();

      expect(mockShowMessageBox).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Failed to start server',
          detail: expect.stringContaining('15 seconds'),
          buttons: ['Retry', 'Quit'],
        })
      );
      expect(mockQuit).toHaveBeenCalled();
    }, 20_000);

    it('should emit error status when server fails to start', async () => {
      const error = new Error('Unknown failure');
      mockStart.mockRejectedValueOnce(error);
      mockShowMessageBox.mockResolvedValueOnce({ response: 1 }); // Quit

      await startServer();

      // Should have emitted error status
      expect(mockWebContentsSend).toHaveBeenCalledWith('server:status', {
        running: false,
        error: 'Unknown failure',
      });
    });
  });

  describe('stopServer()', () => {
    it('should stop the server and emit stopped status', async () => {
      // First start the server
      await startServer();
      vi.clearAllMocks();

      await stopServer();

      expect(mockStop).toHaveBeenCalled();
      expect(mockWebContentsSend).toHaveBeenCalledWith('server:status', { running: false });
    });

    it('should resolve gracefully if no server is running', async () => {
      // stopServer without a running server should not throw
      await expect(stopServer()).resolves.toBeUndefined();
    });

    it('should force-terminate on timeout (resolve without error)', async () => {
      // Start server first
      await startServer();
      vi.clearAllMocks();

      // Make stop hang forever
      mockStop.mockImplementationOnce(() => new Promise(() => {}));

      // Should resolve (not reject) even on timeout
      await expect(stopServer()).resolves.toBeUndefined();
      expect(mockWebContentsSend).toHaveBeenCalledWith('server:status', { running: false });
    }, 15_000);
  });

  describe('restartServer()', () => {
    it('should stop then start the server and show notification', async () => {
      // Start server first
      await startServer();
      vi.clearAllMocks();

      await restartServer();

      expect(mockStop).toHaveBeenCalled();
      expect(mockStart).toHaveBeenCalled();
      expect(mockNotificationShow).toHaveBeenCalled();
    });
  });

  describe('getServerStatus()', () => {
    it('should return running status after successful start', async () => {
      await startServer();

      const status = getServerStatus();
      expect(status).toEqual({ running: true });
    });

    it('should return stopped status initially or after stop', async () => {
      await startServer();
      await stopServer();

      const status = getServerStatus();
      expect(status).toEqual({ running: false });
    });
  });
});
