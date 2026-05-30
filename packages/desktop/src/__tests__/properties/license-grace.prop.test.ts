/**
 * Property-Based Test: Grace Period Tier Resolution (Property 5)
 *
 * For any last-validated timestamp and current time, if the Remote Web App is
 * unreachable: when the elapsed time since last validation is ≤ 7 days, the
 * cached license tier SHALL be returned; when the elapsed time exceeds 7 days,
 * the tier SHALL resolve to "free".
 *
 * **Validates: Requirements 7.4, 7.6, 7.7**
 *
 * Feature: electron-desktop-app, Property 5: Grace Period Tier Resolution
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// Pure function under test
// ---------------------------------------------------------------------------

const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function resolveGracePeriodTier(
  lastValidatedAt: Date,
  now: Date,
  cachedTier: 'free' | 'pro' | 'pro+rooms'
): 'free' | 'pro' | 'pro+rooms' {
  const elapsed = now.getTime() - lastValidatedAt.getTime();
  if (elapsed <= GRACE_PERIOD_MS) {
    return cachedTier;
  }
  return 'free';
}

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/** Generate a date within the past year */
const lastValidatedAtArb = fc.date({
  min: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
  max: new Date(),
});

/** Generate a license tier */
const tierArb = fc.constantFrom<'free' | 'pro' | 'pro+rooms'>('free', 'pro', 'pro+rooms');

// ---------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------

describe('Property 5: Grace Period Tier Resolution', () => {
  it('within grace period (≤ 7 days elapsed): returns cached tier', () => {
    fc.assert(
      fc.property(
        lastValidatedAtArb,
        tierArb,
        // Generate elapsed time within grace period: 0 to GRACE_PERIOD_MS inclusive
        fc.integer({ min: 0, max: GRACE_PERIOD_MS }),
        (lastValidatedAt, cachedTier, elapsedMs) => {
          const now = new Date(lastValidatedAt.getTime() + elapsedMs);
          const result = resolveGracePeriodTier(lastValidatedAt, now, cachedTier);
          expect(result).toBe(cachedTier);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('grace period expired (> 7 days elapsed): returns free tier', () => {
    fc.assert(
      fc.property(
        lastValidatedAtArb,
        tierArb,
        // Generate elapsed time beyond grace period: GRACE_PERIOD_MS + 1 to ~365 days
        fc.integer({ min: GRACE_PERIOD_MS + 1, max: 365 * 24 * 60 * 60 * 1000 }),
        (lastValidatedAt, cachedTier, elapsedMs) => {
          const now = new Date(lastValidatedAt.getTime() + elapsedMs);
          const result = resolveGracePeriodTier(lastValidatedAt, now, cachedTier);
          expect(result).toBe('free');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('boundary: exactly 7 days elapsed returns cached tier (≤ condition)', () => {
    fc.assert(
      fc.property(
        lastValidatedAtArb,
        tierArb,
        (lastValidatedAt, cachedTier) => {
          const now = new Date(lastValidatedAt.getTime() + GRACE_PERIOD_MS);
          const result = resolveGracePeriodTier(lastValidatedAt, now, cachedTier);
          // Exactly 7 days is within grace period (≤)
          expect(result).toBe(cachedTier);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('boundary: exactly 7 days + 1ms elapsed returns free tier', () => {
    fc.assert(
      fc.property(
        lastValidatedAtArb,
        tierArb,
        (lastValidatedAt, cachedTier) => {
          const now = new Date(lastValidatedAt.getTime() + GRACE_PERIOD_MS + 1);
          const result = resolveGracePeriodTier(lastValidatedAt, now, cachedTier);
          // One millisecond past grace period → free
          expect(result).toBe('free');
        }
      ),
      { numRuns: 100 }
    );
  });
});
