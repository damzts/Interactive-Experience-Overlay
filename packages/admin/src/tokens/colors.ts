/**
 * Semantic color tokens for the IEOM Admin Panel design system.
 *
 * Colors are organized by semantic purpose and follow color psychology principles:
 * - Primary (Cyan): Trust, reliability, technological competence
 * - Accent (Amber/Gold): Achievement, motivation, warmth
 * - Success (Emerald): Progress, health, completion
 * - Danger (Red): Errors, destructive actions, alerts
 * - Creative (Violet): Premium features, inspiration, exclusivity
 * - Neutral (Zinc): Text, borders, backgrounds
 *
 * Each scale follows a numbered system (50-900) where lower numbers are lighter
 * and higher numbers are darker/more saturated.
 *
 * @example
 * ```ts
 * import { primary, accent } from '../tokens/colors';
 * // Use in inline styles or for CSS custom property generation
 * const style = { color: primary[400] };
 * ```
 */

/**
 * Represents a color scale with numbered stops from light (50) to dark (900).
 * Steps 800 and 900 are optional as not all scales require the full range.
 */
export interface ColorScale {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800?: string;
  900?: string;
}

/**
 * Neutral color tokens for text, borders, and background surfaces.
 * Uses Zinc-based values optimized for dark mode readability.
 */
export interface NeutralScale {
  /** Darkest background — app base */
  bgBase: string;
  /** Surface-level background — cards, panels */
  bgSurface: string;
  /** Elevated background — dropdowns, popovers */
  bgElevated: string;
  /** Semi-transparent overlay backdrop */
  bgOverlay: string;
  /** Primary text — headings, body */
  textPrimary: string;
  /** Secondary text — descriptions, labels */
  textSecondary: string;
  /** Muted text — placeholders, disabled */
  textMuted: string;
  /** Default border — subtle separators */
  borderDefault: string;
  /** Strong border — active/focused elements */
  borderStrong: string;
}

/**
 * Primary color scale — Cyan tones.
 * Conveys trust, reliability, and technological competence.
 * Used for primary interactive elements, links, and focus indicators.
 */
export const primary: ColorScale = {
  50: '#ecfeff',
  100: '#cffafe',
  200: '#a5f3fc',
  300: '#67e8f9',
  400: '#22d3ee',
  500: '#06b6d4',
  600: '#0891b2',
  700: '#0e7490',
};

/**
 * Accent color scale — Amber/Gold tones.
 * Triggers feelings of accomplishment, motivation, and warmth.
 * Used for achievement indicators, save confirmations, and progress milestones.
 */
export const accent: ColorScale = {
  50: '#fffbeb',
  100: '#fef3c7',
  200: '#fde68a',
  300: '#fcd34d',
  400: '#fbbf24',
  500: '#f59e0b',
  600: '#d97706',
  700: '#b45309',
};

/**
 * Success color scale — Emerald tones.
 * Communicates health, progress, and completion.
 * Used for success states, active connections, and live indicators.
 */
export const success: ColorScale = {
  50: '#ecfdf5',
  100: '#d1fae5',
  200: '#a7f3d0',
  300: '#6ee7b7',
  400: '#34d399',
  500: '#10b981',
  600: '#059669',
  700: '#047857',
};

/**
 * Danger color scale — Red tones.
 * Signals errors, destructive actions, and critical alerts.
 * Used for error states, delete confirmations, and warning indicators.
 */
export const danger: ColorScale = {
  50: '#fef2f2',
  100: '#fee2e2',
  200: '#fecaca',
  300: '#fca5a5',
  400: '#f87171',
  500: '#ef4444',
  600: '#dc2626',
  700: '#b91c1c',
};

/**
 * Creative color scale — Violet tones.
 * Evokes inspiration, exclusivity, and premium quality.
 * Used for creative features, premium indicators, and special actions.
 */
export const creative: ColorScale = {
  50: '#f5f3ff',
  100: '#ede9fe',
  200: '#ddd6fe',
  300: '#c4b5fd',
  400: '#a78bfa',
  500: '#8b5cf6',
  600: '#7c3aed',
  700: '#6d28d9',
};

/**
 * Neutral color tokens — Zinc-based values for text, borders, and backgrounds.
 * Optimized for dark mode with careful contrast ratios for extended use sessions.
 * Backgrounds use near-black zinc tones; text uses light zinc for readability.
 */
export const neutral: NeutralScale = {
  bgBase: '#09090b',
  bgSurface: '#18181b',
  bgElevated: '#27272a',
  bgOverlay: 'rgba(9, 9, 11, 0.85)',
  textPrimary: '#f4f4f5',
  textSecondary: '#a1a1aa',
  textMuted: '#71717a',
  borderDefault: 'rgba(255, 255, 255, 0.08)',
  borderStrong: 'rgba(255, 255, 255, 0.16)',
};

/**
 * Complete color token collection for the design system.
 * Groups all semantic color scales into a single object for bulk access.
 *
 * @example
 * ```ts
 * import { colors } from '../tokens/colors';
 * // Generate CSS custom properties from all color tokens
 * Object.entries(colors.primary).forEach(([step, value]) => {
 *   document.documentElement.style.setProperty(`--color-primary-${step}`, value);
 * });
 * ```
 */
export const colors = {
  primary,
  accent,
  success,
  danger,
  creative,
  neutral,
} as const;
