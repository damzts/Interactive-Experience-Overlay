import { useId, type ButtonHTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

/**
 * Toggle atom component for the IEOM Admin Panel design system.
 *
 * Renders an accessible switch control with spring-animated thumb transition,
 * three size variants (sm, md, lg), optional label, and disabled state.
 * Uses `role="switch"` and `aria-checked` for screen reader compatibility.
 * The thumb slides with a spring easing curve (cubic-bezier(0.34, 1.56, 0.64, 1))
 * for tactile, satisfying feedback.
 *
 * @example
 * ```tsx
 * <Toggle
 *   checked={enabled}
 *   onChange={setEnabled}
 *   size="md"
 *   label="Enable notifications"
 * />
 * ```
 */

export interface ToggleProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'role'> {
  /** Whether the toggle is in the "on" position */
  checked: boolean;
  /** Callback fired when the toggle is switched */
  onChange: (checked: boolean) => void;
  /** Size preset controlling track and thumb dimensions */
  size: 'sm' | 'md' | 'lg';
  /** Optional label rendered next to the toggle */
  label?: string;
  /** Disables interaction and reduces opacity */
  disabled?: boolean;
  /** HTML id for label association; auto-generated if not provided */
  id?: string;
}

/** Track dimensions per size variant: [width, height] in Tailwind classes */
const trackStyles: Record<ToggleProps['size'], string> = {
  sm: 'w-8 h-4',
  md: 'w-10 h-5',
  lg: 'w-12 h-6',
};

/** Thumb diameter per size variant */
const thumbStyles: Record<ToggleProps['size'], string> = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
};

/** Thumb translate distance when checked (moves to right) */
const thumbCheckedTranslate: Record<ToggleProps['size'], string> = {
  sm: 'translate-x-4',
  md: 'translate-x-5',
  lg: 'translate-x-6',
};

/** Label text size per toggle size */
const labelStyles: Record<ToggleProps['size'], string> = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
};

export function Toggle({
  checked,
  onChange,
  size,
  label,
  disabled = false,
  id,
  className,
  ...rest
}: ToggleProps) {
  const autoId = useId();
  const toggleId = id ?? autoId;

  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <button
        type="button"
        id={toggleId}
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          // Track base
          'relative inline-flex items-center shrink-0 rounded-full',
          'transition-colors duration-[var(--duration-normal)] ease-[var(--ease-default)]',
          // Focus ring
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-400)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-base)]',
          // Track color states
          checked
            ? 'bg-[var(--color-primary-500)]'
            : 'bg-[var(--color-border-strong)]',
          // Disabled state
          disabled && 'opacity-50 pointer-events-none',
          // Track size
          trackStyles[size],
        )}
        {...rest}
      >
        {/* Thumb */}
        <span
          aria-hidden="true"
          className={cn(
            'inline-block rounded-full bg-white shadow-sm',
            'transition-transform duration-[var(--duration-normal)] ease-[var(--ease-spring)]',
            // Thumb size
            thumbStyles[size],
            // Position: offset from left edge
            'ml-0.5',
            // Slide right when checked
            checked ? thumbCheckedTranslate[size] : 'translate-x-0',
          )}
        />
      </button>

      {label && (
        <label
          htmlFor={toggleId}
          className={cn(
            'select-none text-[var(--color-text-primary)]',
            labelStyles[size],
            disabled && 'opacity-50 cursor-not-allowed',
            !disabled && 'cursor-pointer',
          )}
        >
          {label}
        </label>
      )}
    </div>
  );
}
