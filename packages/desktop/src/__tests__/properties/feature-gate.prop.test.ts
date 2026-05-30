/**
 * Property-based test: Feature Gating by License Tier (Property 6)
 *
 * For any feature in the feature gate map and for any license tier, the feature
 * SHALL be enabled if and only if the user's tier meets or exceeds the feature's
 * required tier (free < pro < pro+rooms). When a feature is disabled, the gate
 * SHALL report the minimum required tier for that feature.
 *
 * **Validates: Requirements 8.2, 8.3, 8.4, 8.6**
 */

import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// Mocks — required because ipc-handlers.ts imports Electron modules
// ---------------------------------------------------------------------------

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  app: { getVersion: () => '1.0.0' },
  shell: { openExternal: vi.fn() },
  BrowserWindow: { getAllWindows: () => [] },
}));

vi.mock('../../main/license.js', () => ({
  getLicenseTier: () => 'free',
  validateLicense: vi.fn(),
}));

vi.mock('../../main/token-storage.js', () => ({
  clearToken: vi.fn(),
}));

vi.mock('../../main/startup.js', () => ({
  getLaunchAtStartup: () => false,
  setLaunchAtStartup: vi.fn(),
}));

vi.mock('../../main/auto-updater.js', () => ({
  installUpdate: vi.fn(),
}));

// Import after mocks
const { isFeatureEnabled, getRequiredTier, FEATURE_GATES } = await import(
  '../../main/ipc-handlers.js'
);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TIERS = ['free', 'pro', 'pro+rooms'] as const;
type LicenseTier = (typeof TIERS)[number];

const TIER_ORDER: Record<LicenseTier, number> = {
  free: 0,
  pro: 1,
  'pro+rooms': 2,
};

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Arbitrary that picks a feature from the FEATURE_GATES map */
const featureArb = fc.constantFrom(...Object.keys(FEATURE_GATES));

/** Arbitrary that picks a license tier */
const tierArb = fc.constantFrom<LicenseTier>(...TIERS);

/** Arbitrary that generates a random string NOT in the feature gate map */
const unknownFeatureArb = fc
  .string({ minLength: 1, maxLength: 50 })
  .filter((s) => !(s in FEATURE_GATES));

// ---------------------------------------------------------------------------
// Property Tests
// ---------------------------------------------------------------------------

describe('Feature: electron-desktop-app, Property 6: Feature Gating by License Tier', () => {
  it('feature is enabled iff tier >= required tier for all (feature, tier) combinations', () => {
    fc.assert(
      fc.property(featureArb, tierArb, (feature, tier) => {
        const requiredTier = FEATURE_GATES[feature] as LicenseTier;
        const expected = TIER_ORDER[tier] >= TIER_ORDER[requiredTier];
        const actual = isFeatureEnabled(feature, tier);

        expect(actual).toBe(expected);
      }),
      { numRuns: 100 },
    );
  });

  it('when a feature is disabled, getRequiredTier reports the minimum required tier', () => {
    fc.assert(
      fc.property(featureArb, tierArb, (feature, tier) => {
        const enabled = isFeatureEnabled(feature, tier);

        if (!enabled) {
          const requiredTier = getRequiredTier(feature);
          expect(requiredTier).toBeDefined();
          expect(requiredTier).toBe(FEATURE_GATES[feature]);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('unknown features (not in gate map) are always enabled regardless of tier', () => {
    fc.assert(
      fc.property(unknownFeatureArb, tierArb, (feature, tier) => {
        const result = isFeatureEnabled(feature, tier);
        expect(result).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});
