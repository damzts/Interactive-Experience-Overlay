/**
 * Unit tests for the startup behavior module.
 * Tests: isAutoLaunched, setLaunchAtStartup, getLaunchAtStartup, DB lifecycle.
 *
 * Validates: Requirements 14.1, 14.2, 14.3, 14.4
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks (vi.hoisted ensures these are initialized before vi.mock factories
// run, which is required by vitest 4 — vitest 2 was more lenient)
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  mockGetLoginItemSettings: vi.fn(() => ({
    wasOpenedAtLogin: false,
    openAtLogin: false,
  })),
  mockSetLoginItemSettings: vi.fn(),
  mockPrepare: vi.fn(),
  mockPragma: vi.fn(),
  mockClose: vi.fn(),
  mockRun: vi.fn(),
  mockGet: vi.fn(),
}));

const mockDbInstance = {
  prepare: mocks.mockPrepare,
  pragma: mocks.mockPragma,
  close: mocks.mockClose,
};

vi.mock('electron', () => ({
  app: {
    getLoginItemSettings: function () { return mocks.mockGetLoginItemSettings(); },
    setLoginItemSettings: function (...args: unknown[]) { return mocks.mockSetLoginItemSettings(...args); },
  },
}));

vi.mock('better-sqlite3', () => ({
  default: vi.fn(function () { return mockDbInstance; }),
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
    mocks.mockPrepare.mockReturnValue({ run: mocks.mockRun, get: mocks.mockGet });
    mocks.mockGet.mockReturnValue(undefined);
  });

  describe('isAutoLaunched()', () => {
    it('should return true when wasOpenedAtLogin is true', () => {
      mocks.mockGetLoginItemSettings.mockReturnValue({
        wasOpenedAtLogin: true,
        openAtLogin: true,
      });

      expect(isAutoLaunched()).toBe(true);
    });

    it('should return false when wasOpenedAtLogin is false and no CLI args', () => {
      mocks.mockGetLoginItemSettings.mockReturnValue({
        wasOpenedAtLogin: false,
        openAtLogin: false,
      });

      // process.argv doesn't contain --hidden or --autostart by default in tests
      expect(isAutoLaunched()).toBe(false);
    });

    it('should return true when --hidden arg is present (Linux fallback)', () => {
      mocks.mockGetLoginItemSettings.mockReturnValue({
        wasOpenedAtLogin: false,
        openAtLogin: false,
      });

      const originalArgv = process.argv;
      process.argv = ['electron', '.', '--hidden'];

      expect(isAutoLaunched()).toBe(true);

      process.argv = originalArgv;
    });

    it('should return true when --autostart arg is present (Linux fallback)', () => {
      mocks.mockGetLoginItemSettings.mockReturnValue({
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

      expect(mocks.mockSetLoginItemSettings).toHaveBeenCalledWith({
        openAtLogin: true,
        openAsHidden: true,
        args: ['--hidden'],
      });
    });

    it('should call app.setLoginItemSettings with openAtLogin=false when disabled', () => {
      openAppSettingsDb('/mock/path/ieom.db');

      setLaunchAtStartup(false);

      expect(mocks.mockSetLoginItemSettings).toHaveBeenCalledWith({
        openAtLogin: false,
        openAsHidden: true,
        args: [],
      });
    });

    it('should persist the preference to the database', () => {
      openAppSettingsDb('/mock/path/ieom.db');

      setLaunchAtStartup(true);

      expect(mocks.mockPrepare).toHaveBeenCalled();
      expect(mocks.mockRun).toHaveBeenCalledWith(1);
    });

    it('should persist 0 when disabling', () => {
      openAppSettingsDb('/mock/path/ieom.db');

      setLaunchAtStartup(false);

      expect(mocks.mockRun).toHaveBeenCalledWith(0);
    });
  });

  describe('getLaunchAtStartup()', () => {
    it('should return false when no row exists', () => {
      openAppSettingsDb('/mock/path/ieom.db');
      mocks.mockGet.mockReturnValue(undefined);

      expect(getLaunchAtStartup()).toBe(false);
    });

    it('should return true when launch_at_startup is 1', () => {
      openAppSettingsDb('/mock/path/ieom.db');
      mocks.mockGet.mockReturnValue({ launch_at_startup: 1 });

      expect(getLaunchAtStartup()).toBe(true);
    });

    it('should return false when launch_at_startup is 0', () => {
      openAppSettingsDb('/mock/path/ieom.db');
      mocks.mockGet.mockReturnValue({ launch_at_startup: 0 });

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

      expect(Database).toHaveBeenCalledWith('/mock/path/ieom.db');
      expect(mocks.mockPragma).toHaveBeenCalledWith('journal_mode = WAL');
    });
  });

  describe('closeAppSettingsDb()', () => {
    it('should close the database connection', () => {
      openAppSettingsDb('/mock/path/ieom.db');
      closeAppSettingsDb();

      expect(mocks.mockClose).toHaveBeenCalled();
    });
  });
});
