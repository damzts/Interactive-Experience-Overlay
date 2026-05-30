/**
 * Property-based tests for Deep Link Token Extraction and JWT Validation.
 *
 * Property 3: For any deep link URL in the format `ieom://auth?token=X`,
 * if X is a non-empty string consisting of three non-empty base64url-encoded
 * parts separated by dots (header.payload.signature), the token SHALL be accepted.
 * For any deep link URL where the token parameter is missing, empty, or not
 * parseable as a three-part JWT, the token SHALL be rejected.
 *
 * **Validates: Requirements 5.4, 5.5, 5.6**
 */

import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';

// Mock electron and token-storage to allow importing deeplink module in test env
vi.mock('electron', () => ({
  app: {
    setAsDefaultProtocolClient: vi.fn(),
    getPath: vi.fn(() => '/mock/userData'),
  },
  Notification: class {
    show = vi.fn();
    constructor(_opts: unknown) {}
  },
}));

vi.mock('../../main/token-storage.js', () => ({
  saveToken: vi.fn(),
}));

const { isValidJwtFormat } = await import('../../main/deeplink.js');

// Base64url alphabet: A-Z, a-z, 0-9, -, _
const BASE64URL_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/**
 * Arbitrary that generates a non-empty base64url segment (1+ chars from the base64url alphabet).
 */
const base64urlSegment = fc.stringOf(
  fc.constantFrom(...BASE64URL_CHARS.split('')),
  { minLength: 1 }
);

/**
 * Arbitrary that generates a valid JWT: three non-empty base64url segments separated by dots.
 */
const validJwt = fc.tuple(base64urlSegment, base64urlSegment, base64urlSegment).map(
  ([header, payload, signature]) => `${header}.${payload}.${signature}`
);

describe('Property 3: Deep Link Token Extraction and JWT Validation', () => {
  it('should accept any token with three non-empty base64url segments separated by dots', () => {
    fc.assert(
      fc.property(validJwt, (token) => {
        expect(isValidJwtFormat(token)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('should reject empty tokens', () => {
    expect(isValidJwtFormat('')).toBe(false);
  });

  it('should reject tokens with fewer than three segments (1 or 2 parts)', () => {
    // Generate tokens with 1 segment (no dots)
    const singleSegment = base64urlSegment;
    // Generate tokens with 2 segments (one dot)
    const twoSegments = fc.tuple(base64urlSegment, base64urlSegment).map(
      ([a, b]) => `${a}.${b}`
    );

    fc.assert(
      fc.property(singleSegment, (token) => {
        expect(isValidJwtFormat(token)).toBe(false);
      }),
      { numRuns: 100 }
    );

    fc.assert(
      fc.property(twoSegments, (token) => {
        expect(isValidJwtFormat(token)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('should reject tokens with more than three segments (4+ parts)', () => {
    const fourOrMoreSegments = fc
      .integer({ min: 4, max: 10 })
      .chain((numSegments) =>
        fc.tuple(...Array.from({ length: numSegments }, () => base64urlSegment))
      )
      .map((segments) => (segments as string[]).join('.'));

    fc.assert(
      fc.property(fourOrMoreSegments, (token) => {
        expect(isValidJwtFormat(token)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('should reject tokens where any segment is empty', () => {
    // Generate three segments where at least one is empty
    const segmentOrEmpty = fc.oneof(
      { weight: 1, arbitrary: fc.constant('') },
      { weight: 3, arbitrary: base64urlSegment }
    );

    const threePartsWithAtLeastOneEmpty = fc
      .tuple(segmentOrEmpty, segmentOrEmpty, segmentOrEmpty)
      .filter(([a, b, c]) => a === '' || b === '' || c === '')
      .map(([a, b, c]) => `${a}.${b}.${c}`);

    fc.assert(
      fc.property(threePartsWithAtLeastOneEmpty, (token) => {
        expect(isValidJwtFormat(token)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('should reject tokens with characters outside the base64url alphabet', () => {
    // Characters that are NOT in the base64url alphabet but might appear in tokens
    const invalidChars = '=+/!@#$%^&*() \t\n';

    // Generate a three-part token where at least one segment contains an invalid char
    const segmentWithInvalidChar = fc
      .tuple(
        base64urlSegment,
        fc.constantFrom(...invalidChars.split('')),
        base64urlSegment
      )
      .map(([prefix, badChar, suffix]) => `${prefix}${badChar}${suffix}`);

    const tokenWithInvalidChars = fc
      .tuple(
        fc.oneof(segmentWithInvalidChar, base64urlSegment),
        fc.oneof(segmentWithInvalidChar, base64urlSegment),
        fc.oneof(segmentWithInvalidChar, base64urlSegment)
      )
      .filter(
        ([a, b, c]) =>
          // Ensure at least one segment has an invalid char
          [...invalidChars].some(
            (ch) => a.includes(ch) || b.includes(ch) || c.includes(ch)
          )
      )
      .map(([a, b, c]) => `${a}.${b}.${c}`);

    fc.assert(
      fc.property(tokenWithInvalidChars, (token) => {
        expect(isValidJwtFormat(token)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });
});
