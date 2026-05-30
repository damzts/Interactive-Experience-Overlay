/**
 * Unit tests for the startup behavior module.
 * Tests: isAutoLaunched, setLaunchAtStartup, getLaunchAtStartup, DB lifecycle.
 *
 * Validates: Requirements 14.1, 14.2, 14.3, 14.4
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetLoginItemSettings = vi.fn(() => ({
  wasOpenedAtLogin: false,
  openAtLogin: false,
}));
const mockSetLoginItemSettings = vi.fn();

vi.mock('electron', () => ({
  app: {
    getLoginItemSettings: () => mockGetLoginItemSettings(),
    setLoginItemSettings: (...args: unknown[]) => mockSetLoginItemSettings(...args),
  },
}));

// Mock better-sqlite3
const mockPrepare = vi.fn();
const mockPragma = vi.fn();
const mockClose = vi.fn();
const mockRun = vi.fn();
const mockGet = vi.fn();

const mockDbInstance = {
  prepare: mockPrepare,
  pragma: mockPragma,
  close: mockClose,
};

vi.mock('better-sqlite3', () => ({
  default: vi.fn(() => mockDbInstance),
}));

// Import after mocks
const {
  isAutoLaunched,
  setLaunchAtStartup,
  getLaunchAtStartup,
  openAppSettingsDb,
  closeAppSettingsDb,
} = await import('../../main/startup.js');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('startup module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrepare.mockReturnValue({ run: mockRun, get: mockGet });
    mockGet.mockReturnValue(undefined);
  });

  describe('isAutoLaunched()', () => {
    it('should return true when wasOpenedAtLogin is true', () => {
      mockGetLoginItemSettings.mockReturnValue({
        wasOpenedAtLogin: true,
        openAtLogin: true,
      });

      expect(isAutoLaunched()).toBe(true);
    });

    it('should return false when wasOpenedAtLogin is false and no CLI args', () => {
      mockGetLoginItemSettings.mockReturnValue({
        wasOpenedAtLogin: false,
        openAtLogin: false,
      });

      // process.argv doesn't contain --hidden or --autostart by default in tests
      expect(isAutoLaunched()).toBe(false);
    });

    it('should return true when --hidden arg is present (Linux fallback)', () => {
      mockGetLoginItemSettings.mockReturnValue({
        wasOpenedAtLogin: false,
        openAtLogin: false,
      });

      const originalArgv = process.argv;
      process.argv = ['electron', '.', '--hidden'];

      expect(isAutoLaunched()).toBe(true);

      process.argv = originalArgv;
    });

    it('should return true when --autostart arg is present (Linux fallback)', () => {
      mockGetLoginItemSettings.mockReturnValue({
        wasOpenedAtLogin: false,
        openAtLogin: false,
      });

      const originalArgv = process.argv;
      process.argv = ['electron', '.', '--autostart'];

      expect(isAutoLaunched()).toBe(true);

      process.argv = originalArgv;
    });
  });

  describe('setLaunchAtStartup()', () => {
    it('should call app.setLoginItemSettings with openAtLogin=true when enabled', () => {
      openAppSettingsDb('/mock/path/ieom.db');

      setLaunchAtStartup(true);

      expect(mockSetLoginItemSettings).toHaveBeenCalledWith({
        openAtLogin: true,
        openAsHidden: true,
        args: ['--hidden'],
      });
    });

    it('should call app.setLoginItemSettings with openAtLogin=false when disabled', () => {
      openAppSettingsDb('/mock/path/ieom.db');

      setLaunchAtStartup(false);

      expect(mockSetLoginItemSettings).toHaveBeenCalledWith({
        openAtLogin: false,
        openAsHidden: true,
        args: [],
      });
    });

    it('should persist the preference to the database', () => {
      openAppSettingsDb('/mock/path/ieom.db');

      setLaunchAtStartup(true);

      expect(mockPrepare).toHaveBeenCalled();
      expect(mockRun).toHaveBeenCalledWith(1);
    });

    it('should persist 0 when disabling', () => {
      openAppSettingsDb('/mock/path/ieom.db');

      setLaunchAtStartup(false);

      expect(mockRun).toHaveBeenCalledWith(0);
    });
  });

  describe('getLaunchAtStartup()', () => {
    it('should return false when no row exists', () => {
      openAppSettingsDb('/mock/path/ieom.db');
      mockGet.mockReturnValue(undefined);

      expect(getLaunchAtStartup()).toBe(false);
    });

    it('should return true when launch_at_startup is 1', () => {
      openAppSettingsDb('/mock/path/ieom.db');
      mockGet.mockReturnValue({ launch_at_startup: 1 });

      expect(getLaunchAtStartup()).toBe(true);
    });

    it('should return false when launch_at_startup is 0', () => {
      openAppSettingsDb('/mock/path/ieom.db');
      mockGet.mockReturnValue({ launch_at_startup: 0 });

      expect(getLaunchAtStartup()).toBe(false);
    });

    it('should return false when database is not open', () => {
      closeAppSettingsDb();

      expect(getLaunchAtStartup()).toBe(false);
    });
  });

  describe('openAppSettingsDb()', () => {
    it('should open the database with fileMustExist and WAL mode', async () => {
      const Database = vi.mocked(
        (await import('better-sqlite3')).default
      );

      openAppSettingsDb('/mock/path/ieom.db');

      expect(Database).toHaveBeenCalledWith('/mock/path/ieom.db', { fileMustExist: true });
      expect(mockPragma).toHaveBeenCalledWith('journal_mode = WAL');
    });
  });

  describe('closeAppSettingsDb()', () => {
    it('should close the database connection', () => {
      openAppSettingsDb('/mock/path/ieom.db');
      closeAppSettingsDb();

      expect(mockClose).toHaveBeenCalled();
    });
  });
});
