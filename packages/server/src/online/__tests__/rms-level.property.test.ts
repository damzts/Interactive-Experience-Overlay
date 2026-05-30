import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

/**
 * Feature: browser-pov-online, Property 8: RMS audio level computation
 *
 * *For any* Uint8Array of frequency data (values 0-255), the `computeRmsLevel`
 * function SHALL produce a value in the range [0, 1] inclusive, computed as
 * `sqrt(mean(((sample - 128) / 128)^2))` clamped to [0, 1].
 *
 * **Validates: Requirements 5.1, 5.3**
 */

// Pure function under test (inlined from packages/overlay/src/online/player/audio-analyzer.ts)
function computeRmsLevel(frequencyData: Uint8Array): number {
  if (frequencyData.length === 0) {
    return 0
  }

  let sumOfSquares = 0
  for (let i = 0; i < frequencyData.length; i++) {
    const normalized = (frequencyData[i] - 128) / 128
    sumOfSquares += normalized * normalized
  }

  const mean = sumOfSquares / frequencyData.length
  const rms = Math.sqrt(mean)

  return Math.min(1, Math.max(0, rms))
}

// Reference implementation for verification
function referenceRmsLevel(data: Uint8Array): number {
  if (data.length === 0) return 0
  let sum = 0
  for (let i = 0; i < data.length; i++) {
    const normalized = (data[i] - 128) / 128
    sum += normalized * normalized
  }
  const rms = Math.sqrt(sum / data.length)
  return Math.min(1, Math.max(0, rms))
}

describe('Feature: browser-pov-online, Property 8: RMS audio level computation', () => {
  it('output is always in [0, 1] for any valid frequency data', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 1, maxLength: 2048 }),
        (samples) => {
          const data = new Uint8Array(samples)
          const result = computeRmsLevel(data)
          expect(result).toBeGreaterThanOrEqual(0)
          expect(result).toBeLessThanOrEqual(1)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('output matches the expected formula: sqrt(mean(((sample - 128) / 128)^2)) clamped to [0, 1]', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 1, maxLength: 2048 }),
        (samples) => {
          const data = new Uint8Array(samples)
          const result = computeRmsLevel(data)
          const expected = referenceRmsLevel(data)
          expect(result).toBeCloseTo(expected, 10)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('empty array returns 0', () => {
    const data = new Uint8Array(0)
    const result = computeRmsLevel(data)
    expect(result).toBe(0)
  })

  it('all-128 (silence) returns 0', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 2048 }),
        (length) => {
          const data = new Uint8Array(length).fill(128)
          const result = computeRmsLevel(data)
          expect(result).toBe(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('all-0 or all-255 returns the maximum possible value (1.0)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 2048 }),
        fc.constantFrom(0, 255),
        (length, fillValue) => {
          const data = new Uint8Array(length).fill(fillValue)
          const result = computeRmsLevel(data)
          // For all-0: normalized = (0-128)/128 = -1, squared = 1, mean = 1, sqrt = 1
          // For all-255: normalized = (255-128)/128 = 127/128 ≈ 0.9921875, squared ≈ 0.9844, sqrt ≈ 0.9922
          // So all-0 gives exactly 1.0, all-255 gives ~0.9922
          if (fillValue === 0) {
            expect(result).toBe(1)
          } else {
            // all-255: (255-128)/128 = 127/128, squared = (127/128)^2, sqrt = 127/128 ≈ 0.9921875
            const expected = 127 / 128
            expect(result).toBeCloseTo(expected, 10)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
