import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { normalizeDb } from '../audio-monitor.js'

/**
 * Feature: multi-camera-pov-switching
 * Property 7: Audio level normalization
 *
 * For any dB value and any valid floor/ceiling configuration (floor < ceiling),
 * the normalized output SHALL equal clamp((dbValue - floor) / (ceiling - floor), 0, 1),
 * producing exactly 0 for values at or below the floor, exactly 1 for values at or
 * above the ceiling, and a linear interpolation between.
 *
 * **Validates: Requirements 3.3**
 */
describe('Property 7: Audio level normalization', () => {
  it('normalized value is always in [0, 1] for any dB value and valid floor/ceiling', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -120, max: 20, noNaN: true }),   // dB value
        fc.double({ min: -100, max: -10, noNaN: true }),  // floor
        fc.double({ min: -5, max: 10, noNaN: true }),     // ceiling
        (dbValue, dbFloor, dbCeiling) => {
          fc.pre(dbFloor < dbCeiling)
          const result = normalizeDb(dbValue, dbFloor, dbCeiling)
          expect(result).toBeGreaterThanOrEqual(0)
          expect(result).toBeLessThanOrEqual(1)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('returns exactly 0 for values at or below the floor', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -100, max: -10, noNaN: true }),  // floor
        fc.double({ min: -5, max: 10, noNaN: true }),     // ceiling
        fc.double({ min: -200, max: 0, noNaN: true }),    // offset (negative or zero)
        (dbFloor, dbCeiling, offset) => {
          fc.pre(dbFloor < dbCeiling)
          // Ensure dbValue is at or below the floor
          const dbValue = dbFloor + Math.min(offset, 0)
          fc.pre(dbValue <= dbFloor)
          const result = normalizeDb(dbValue, dbFloor, dbCeiling)
          expect(result).toBe(0)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('returns exactly 1 for values at or above the ceiling', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -100, max: -10, noNaN: true }),  // floor
        fc.double({ min: -5, max: 10, noNaN: true }),     // ceiling
        fc.double({ min: 0, max: 200, noNaN: true }),     // offset (positive or zero)
        (dbFloor, dbCeiling, offset) => {
          fc.pre(dbFloor < dbCeiling)
          // Ensure dbValue is at or above the ceiling
          const dbValue = dbCeiling + Math.max(offset, 0)
          fc.pre(dbValue >= dbCeiling)
          const result = normalizeDb(dbValue, dbFloor, dbCeiling)
          expect(result).toBe(1)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('produces correct linear interpolation for values between floor and ceiling', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -100, max: -10, noNaN: true }),  // floor
        fc.double({ min: -5, max: 10, noNaN: true }),     // ceiling
        fc.double({ min: 0.01, max: 0.99, noNaN: true }), // fraction (strictly between 0 and 1)
        (dbFloor, dbCeiling, fraction) => {
          fc.pre(dbFloor < dbCeiling)
          // Compute a dB value that is strictly between floor and ceiling
          const dbValue = dbFloor + fraction * (dbCeiling - dbFloor)
          fc.pre(dbValue > dbFloor && dbValue < dbCeiling)

          const result = normalizeDb(dbValue, dbFloor, dbCeiling)
          const expected = (dbValue - dbFloor) / (dbCeiling - dbFloor)

          // Use a small epsilon for floating point comparison
          expect(result).toBeCloseTo(expected, 10)
        },
      ),
      { numRuns: 100 },
    )
  })
})
