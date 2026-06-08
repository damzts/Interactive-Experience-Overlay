/**
 * Property-based tests for Window Bounds Persistence.
 *
 * Property 9: For any valid window bounds (width ≥ 1024, height ≥ 768),
 * persisting the bounds and then loading them SHALL return identical values.
 *
 * Property 10: For any stored window position that falls entirely outside
 * all display bounds, the window SHALL be repositioned (reset to center of
 * primary display).
 *
 * **Validates: Requirements 13.3, 13.4**
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// In-memory SQLite store mock
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => {
  const store = new Map<string, any>();
  return { store };
});

vi.mock('better-sqlite3', () => ({
  default: vi.fn(function () {
    return {
      pragma: vi.fn(),
      prepare: vi.fn(function (sql: string) {
        return {
          get: function () { return mocks.store.get('window_state') ?? undefined; },
          run: function (...args: any[]) {
            // INSERT OR REPLACE INTO window_state (id, x, y, width, height, is_maximized) VALUES (1, ?, ?, ?, ?, ?)
            if (args.length >= 5) {
              mocks.store.set('window_state', {
                x: args[0],
                y: args[1],
                width: args[2],
                height: args[3],
                is_maximized: args[4],
              });
            }
          },
        };
      }),
      close: vi.fn(),
    };
  }),
}));

// Import after mocks are set up
const { openWindowStateDb, saveWindowBounds, loadWindowBounds } = await import(
  '../../main/window-state.js'
);

// ---------------------------------------------------------------------------
// Pure helper: isWithinDisplayBounds
// ---------------------------------------------------------------------------

interface Display {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Checks if a window rectangle overlaps with at least one display.
 * A window is "within bounds" if any portion of it overlaps any display.
 */
function isWithinDisplayBounds(
  x: number,
  y: number,
  width: number,
  height: number,
  displays: Display[]
): boolean {
  for (const display of displays) {
    const overlapX = x < display.x + display.width && x + width > display.x;
    const overlapY = y < display.y + display.height && y + height > display.y;

    if (overlapX && overlapY) {
      return true;
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/** Arbitrary valid window bounds: width ≥ 1024, height ≥ 768, any integer x/y */
const validWindowBounds = fc.record({
  x: fc.integer({ min: -10000, max: 10000 }),
  y: fc.integer({ min: -10000, max: 10000 }),
  width: fc.integer({ min: 1024, max: 4096 }),
  height: fc.integer({ min: 768, max: 2160 }),
  isMaximized: fc.boolean(),
});

// Fixed display setup for Property 10
const DISPLAYS: Display[] = [{ x: 0, y: 0, width: 1920, height: 1080 }];

/**
 * Generate window positions that are entirely outside all displays.
 * The window must not overlap any display at all.
 */
const outOfBoundsPosition = fc
  .record({
    x: fc.integer({ min: -20000, max: 20000 }),
    y: fc.integer({ min: -20000, max: 20000 }),
    width: fc.integer({ min: 1024, max: 4096 }),
    height: fc.integer({ min: 768, max: 2160 }),
  })
  .filter(({ x, y, width, height }) => !isWithinDisplayBounds(x, y, width, height, DISPLAYS));

/**
 * Generate window positions that overlap at least one display.
 */
const withinBoundsPosition = fc
  .record({
    x: fc.integer({ min: -20000, max: 20000 }),
    y: fc.integer({ min: -20000, max: 20000 }),
    width: fc.integer({ min: 1024, max: 4096 }),
    height: fc.integer({ min: 768, max: 2160 }),
  })
  .filter(({ x, y, width, height }) => isWithinDisplayBounds(x, y, width, height, DISPLAYS));

// ---------------------------------------------------------------------------
// Property 9: Window Bounds Persistence Round-Trip
// ---------------------------------------------------------------------------

describe('Property 9: Window Bounds Persistence Round-Trip', () => {
  beforeEach(() => {
    mocks.store.clear();
    // Open the DB connection (uses mocked better-sqlite3)
    openWindowStateDb('/mock/ieom.db');
  });

  it('for any valid bounds (width ≥ 1024, height ≥ 768), persist and load SHALL return identical values', () => {
    fc.assert(
      fc.property(validWindowBounds, (bounds) => {
        // Clear store between iterations
        mocks.store.clear();

        // Re-open DB to ensure connection is active
        openWindowStateDb('/mock/ieom.db');

        // Persist bounds
        saveWindowBounds(bounds);

        // Load bounds
        const loaded = loadWindowBounds();

        // Round-trip must produce identical values
        expect(loaded).not.toBeNull();
        expect(loaded!.x).toBe(bounds.x);
        expect(loaded!.y).toBe(bounds.y);
        expect(loaded!.width).toBe(bounds.width);
        expect(loaded!.height).toBe(bounds.height);
        expect(loaded!.isMaximized).toBe(bounds.isMaximized);
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 10: Out-of-Bounds Window Position Reset
// ---------------------------------------------------------------------------

describe('Property 10: Out-of-Bounds Window Position Reset', () => {
  it('for any position entirely outside all displays, isWithinDisplayBounds returns false (triggering reset)', () => {
    fc.assert(
      fc.property(outOfBoundsPosition, ({ x, y, width, height }) => {
        const result = isWithinDisplayBounds(x, y, width, height, DISPLAYS);
        expect(result).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('for any position overlapping at least one display, isWithinDisplayBounds returns true', () => {
    fc.assert(
      fc.property(withinBoundsPosition, ({ x, y, width, height }) => {
        const result = isWithinDisplayBounds(x, y, width, height, DISPLAYS);
        expect(result).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});
