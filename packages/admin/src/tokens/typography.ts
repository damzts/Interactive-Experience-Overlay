/**
 * Typography tokens for the IEOM Admin Panel design system.
 *
 * Defines font families, sizes, weights, and line heights used throughout
 * the application. Values align with the CSS custom properties defined in
 * the design token system and are optimized for dark-mode readability.
 *
 * @example
 * ```ts
 * import { fontFamily, fontSize, fontWeight, lineHeight } from '../tokens/typography';
 * const style = { fontFamily: fontFamily.sans, fontSize: fontSize.base };
 * ```
 */

/**
 * Font family stacks for the design system.
 * - `sans`: Primary UI font — Inter with system fallbacks.
 * - `mono`: Code and technical content — JetBrains Mono with system fallbacks.
 */
export const fontFamily = {
  /** Primary UI font stack */
  sans: "'Inter', ui-sans-serif, system-ui, sans-serif",
  /** Monospace font stack for code and technical content */
  mono: "'JetBrains Mono', ui-monospace, monospace",
} as const;

/**
 * Font size scale from extra-small to 2x-large.
 * Values use rem units for consistent scaling with user preferences.
 */
export const fontSize = {
  /** 0.75rem — captions, fine print */
  xs: '0.75rem',
  /** 0.875rem — secondary text, labels */
  sm: '0.875rem',
  /** 1rem — body text, default */
  base: '1rem',
  /** 1.125rem — emphasized body, sub-headings */
  lg: '1.125rem',
  /** 1.25rem — section headings */
  xl: '1.25rem',
  /** 1.5rem — page titles, hero text */
  '2xl': '1.5rem',
} as const;

/**
 * Font weight scale for typographic hierarchy.
 * Numeric values correspond to standard CSS font-weight values.
 */
export const fontWeight = {
  /** 400 — body text, descriptions */
  normal: 400,
  /** 500 — labels, navigation items */
  medium: 500,
  /** 600 — sub-headings, emphasis */
  semibold: 600,
  /** 700 — headings, strong emphasis */
  bold: 700,
} as const;

/**
 * Line height scale for readability and vertical rhythm.
 * Named values map to common typographic use cases.
 */
export const lineHeight = {
  /** 1 — single-line elements, icons */
  none: '1',
  /** 1.25 — headings, compact text */
  tight: '1.25',
  /** 1.5 — body text, default reading */
  normal: '1.5',
  /** 1.75 — relaxed reading, large blocks of text */
  relaxed: '1.75',
} as const;

/**
 * Complete typography token collection for the design system.
 * Groups all typographic tokens into a single object for bulk access.
 *
 * @example
 * ```ts
 * import { typography } from '../tokens/typography';
 * // Generate CSS custom properties from typography tokens
 * document.documentElement.style.setProperty('--font-sans', typography.fontFamily.sans);
 * ```
 */
export const typography = {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
} as const;
