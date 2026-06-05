/**
 * Elevation (shadow) tokens for the IEOM Admin Panel design system.
 *
 * Shadows provide visual depth cues and establish a clear elevation hierarchy
 * in the dark-mode interface. Each level increases the blur radius and opacity
 * to simulate progressively higher surfaces:
 *
 * - none: Flat, no elevation (level-0)
 * - sm: Subtle lift — buttons, inputs (level-1)
 * - md: Moderate elevation — cards, dropdowns (level-2)
 * - lg: High elevation — modals, popovers (level-3)
 * - xl: Maximum elevation — floating overlays, command palette (level-4)
 *
 * @example
 * ```ts
 * import { shadows } from '../tokens/shadows';
 * // Use in inline styles or for CSS custom property generation
 * const style = { boxShadow: shadows.md };
 * ```
 */

/**
 * Represents the shadow elevation scale with named keys
 * mapping to CSS box-shadow string values.
 */
export type ShadowScale = Record<'none' | 'sm' | 'md' | 'lg' | 'xl', string>;

/**
 * Shadow elevation tokens — from flat (none) to floating modal (xl).
 *
 * Each level uses increasing vertical offset, blur radius, and opacity
 * to create a natural sense of depth in the dark UI:
 * - none → no shadow (flat surface, level-0)
 * - sm → 0 1px 2px rgba(0, 0, 0, 0.3) (subtle lift, level-1)
 * - md → 0 4px 12px rgba(0, 0, 0, 0.4) (moderate elevation, level-2)
 * - lg → 0 12px 40px rgba(0, 0, 0, 0.5) (high elevation, level-3)
 * - xl → 0 24px 60px rgba(0, 0, 0, 0.6) (maximum elevation, level-4)
 */
export const shadows: ShadowScale = {
  /** Level-0: Flat, no elevation */
  none: 'none',
  /** Level-1: Subtle lift for buttons and inputs */
  sm: '0 1px 2px rgba(0, 0, 0, 0.3)',
  /** Level-2: Moderate elevation for cards and dropdowns */
  md: '0 4px 12px rgba(0, 0, 0, 0.4)',
  /** Level-3: High elevation for modals and popovers */
  lg: '0 12px 40px rgba(0, 0, 0, 0.5)',
  /** Level-4: Maximum elevation for floating overlays */
  xl: '0 24px 60px rgba(0, 0, 0, 0.6)',
} as const;
