/**
 * Spacing tokens for the IEOM Admin Panel design system.
 *
 * Built on a consistent 4px base grid system. Each level multiplies
 * the base unit (4px) by the level number, providing predictable
 * and harmonious spacing throughout the interface.
 *
 * Levels 1–16 cover the full range from tight component padding (4px)
 * to generous section margins (64px).
 *
 * @example
 * ```ts
 * import { spacing } from '../tokens/spacing';
 * // Use in inline styles or for CSS custom property generation
 * const style = { padding: spacing[4], gap: spacing[2] };
 * ```
 */

/** Base unit in pixels for the spacing scale. */
export const SPACING_BASE = 4;

/**
 * Represents the spacing scale type with numeric keys (1–16)
 * mapping to pixel string values.
 */
export type SpacingScale = Record<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16, string>;

/**
 * Spacing scale tokens — 4px base grid, levels 1 through 16.
 *
 * Each level equals `level * 4px`:
 * - 1 → 4px (tight inner padding, icon gaps)
 * - 2 → 8px (compact element spacing)
 * - 3 → 12px (default inner padding)
 * - 4 → 16px (standard component padding)
 * - 5 → 20px (comfortable spacing)
 * - 6 → 24px (card padding, section gaps)
 * - 7 → 28px (generous element spacing)
 * - 8 → 32px (large component padding)
 * - 9 → 36px (section separation)
 * - 10 → 40px (panel gaps)
 * - 11 → 44px (layout spacing)
 * - 12 → 48px (major section margins)
 * - 13 → 52px (large layout gaps)
 * - 14 → 56px (page-level spacing)
 * - 15 → 60px (generous page margins)
 * - 16 → 64px (maximum section separation)
 */
export const spacing: SpacingScale = {
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  7: '28px',
  8: '32px',
  9: '36px',
  10: '40px',
  11: '44px',
  12: '48px',
  13: '52px',
  14: '56px',
  15: '60px',
  16: '64px',
} as const;
