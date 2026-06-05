/**
 * Motion tokens for the IEOM Admin Panel design system.
 *
 * Motion tokens define transition durations and easing curves that create
 * consistent, purposeful animation throughout the interface. The system
 * balances responsiveness with visual polish:
 *
 * Duration scale:
 * - fast: 150ms — micro-interactions, toggles, hover states
 * - normal: 250ms — standard transitions, panel reveals
 * - slow: 400ms — complex animations, page transitions, modals
 *
 * Easing curves:
 * - default: cubic-bezier(0.4, 0, 0.2, 1) — general-purpose ease-in-out
 * - spring: cubic-bezier(0.34, 1.56, 0.64, 1) — playful overshoot for emphasis
 * - out: cubic-bezier(0, 0, 0.2, 1) — deceleration for entering elements
 *
 * @example
 * ```ts
 * import { duration, easing } from '../tokens/motion';
 * // Use in inline styles or for CSS custom property generation
 * const style = { transition: `opacity ${duration.fast} ${easing.default}` };
 * ```
 */

/**
 * Represents the duration scale with named keys
 * mapping to CSS time string values.
 */
export type DurationScale = Record<'fast' | 'normal' | 'slow', string>;

/**
 * Represents the easing curve scale with named keys
 * mapping to CSS timing-function string values.
 */
export type EasingScale = Record<'default' | 'spring' | 'out', string>;

/**
 * Transition duration tokens — from snappy (fast) to cinematic (slow).
 *
 * Each level targets a different class of UI motion:
 * - fast → 150ms (micro-interactions, toggles, hover states)
 * - normal → 250ms (standard transitions, panel reveals)
 * - slow → 400ms (complex animations, page transitions, modals)
 */
export const duration: DurationScale = {
  /** Micro-interactions, toggles, and hover states */
  fast: '150ms',
  /** Standard transitions and panel reveals */
  normal: '250ms',
  /** Complex animations, page transitions, and modals */
  slow: '400ms',
} as const;

/**
 * Easing curve tokens — from neutral (default) to expressive (spring).
 *
 * Each curve serves a distinct animation personality:
 * - default → cubic-bezier(0.4, 0, 0.2, 1) (general-purpose ease-in-out)
 * - spring → cubic-bezier(0.34, 1.56, 0.64, 1) (playful overshoot for emphasis)
 * - out → cubic-bezier(0, 0, 0.2, 1) (deceleration for entering elements)
 */
export const easing: EasingScale = {
  /** General-purpose ease-in-out for most transitions */
  default: 'cubic-bezier(0.4, 0, 0.2, 1)',
  /** Playful overshoot for emphasis and delight */
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  /** Deceleration curve for entering elements */
  out: 'cubic-bezier(0, 0, 0.2, 1)',
} as const;

/**
 * Combined motion tokens object containing both duration and easing scales.
 *
 * Useful when passing the full motion configuration to theme providers
 * or generating CSS custom properties in bulk.
 */
export const motion = {
  duration,
  easing,
} as const;
