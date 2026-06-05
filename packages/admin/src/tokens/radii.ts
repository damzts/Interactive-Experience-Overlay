/**
 * Border-radius tokens for the IEOM Admin Panel design system.
 *
 * Radii define the curvature of element corners, establishing a consistent
 * rounding language across the interface. The scale progresses from no rounding
 * through subtle curves to fully rounded (pill) shapes:
 *
 * - none: Sharp corners, no rounding (0)
 * - sm: Subtle rounding — inputs, small buttons (6px)
 * - md: Default rounding — cards, panels (8px)
 * - lg: Pronounced rounding — modals, large cards (12px)
 * - xl: Heavy rounding — floating elements, tooltips (16px)
 * - full: Pill shape — avatars, tags, circular buttons (9999px)
 *
 * @example
 * ```ts
 * import { radii } from '../tokens/radii';
 * // Use in inline styles or for CSS custom property generation
 * const style = { borderRadius: radii.md };
 * ```
 */

/**
 * Represents the border-radius scale with named keys
 * mapping to CSS border-radius string values.
 */
export type RadiiScale = Record<'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full', string>;

/**
 * Border-radius tokens — from sharp (none) to pill shape (full).
 *
 * Each level provides progressively more rounding to create
 * visual hierarchy and soften the interface:
 * - none → 0px (sharp corners)
 * - sm → 6px (subtle rounding for inputs and small elements)
 * - md → 8px (default rounding for cards and panels)
 * - lg → 12px (pronounced rounding for modals and large cards)
 * - xl → 16px (heavy rounding for floating elements)
 * - full → 9999px (pill shape for avatars and circular buttons)
 */
export const radii: RadiiScale = {
  /** Sharp corners, no rounding */
  none: '0px',
  /** Subtle rounding for inputs and small buttons */
  sm: '6px',
  /** Default rounding for cards and panels */
  md: '8px',
  /** Pronounced rounding for modals and large cards */
  lg: '12px',
  /** Heavy rounding for floating elements and tooltips */
  xl: '16px',
  /** Pill shape for avatars, tags, and circular buttons */
  full: '9999px',
} as const;
