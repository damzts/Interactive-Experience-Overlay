import { type ReactNode } from 'react';
import { cn } from '../../utils/cn';

/**
 * Badge atom component for the IEOM Admin Panel design system.
 *
 * Renders a pill-shaped inline label with five semantic variants
 * (default, primary, success, warning, danger), two sizes (sm, md),
 * and an optional dot indicator for status display.
 *
 * All colors reference CSS custom properties from the design token system.
 *
 * @example
 * ```tsx
 * <Badge variant="success" size="sm" dot>
 *   Live
 * </Badge>
 * ```
 */

export interface BadgeProps {
  /** Visual style variant */
  variant: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  /** Size preset controlling padding and font size */
  size: 'sm' | 'md';
  /** Shows a small colored status dot before the label text */
  dot?: boolean;
  /** Badge label content */
  children: ReactNode;
  /** Additional CSS classes */
  className?: string;
}

const variantStyles: Record<BadgeProps['variant'], string> = {
  default: [
    'bg-[var(--color-bg-elevated)]',
    'text-[var(--color-text-secondary)]',
    'border',
    'border-[var(--color-border-default)]',
  ].join(' '),
  primary: [
    'bg-[var(--color-primary-500)]/15',
    'text-[var(--color-primary-400)]',
  ].join(' '),
  success: [
    'bg-[var(--color-success-500)]/15',
    'text-[var(--color-success-400)]',
  ].join(' '),
  warning: [
    'bg-[var(--color-accent-500)]/15',
    'text-[var(--color-accent-400)]',
  ].join(' '),
  danger: [
    'bg-[var(--color-danger-500)]/15',
    'text-[var(--color-danger-400)]',
  ].join(' '),
};

const dotStyles: Record<BadgeProps['variant'], string> = {
  default: 'bg-[var(--color-text-muted)]',
  primary: 'bg-[var(--color-primary-400)]',
  success: 'bg-[var(--color-success-400)]',
  warning: 'bg-[var(--color-accent-400)]',
  danger: 'bg-[var(--color-danger-400)]',
};

const sizeStyles: Record<BadgeProps['size'], string> = {
  sm: 'px-2 py-0.5 text-[0.6875rem] gap-1',
  md: 'px-2.5 py-1 text-xs gap-1.5',
};

const dotSizeStyles: Record<BadgeProps['size'], string> = {
  sm: 'h-1.5 w-1.5',
  md: 'h-2 w-2',
};

/**
 * Badge — a small pill-shaped label for status, counts, or categories.
 */
export function Badge({
  variant,
  size,
  dot = false,
  children,
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        // Base styles
        'inline-flex items-center font-medium rounded-full',
        'select-none whitespace-nowrap leading-none',
        // Variant & size
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
    >
      {dot && (
        <span
          className={cn(
            'shrink-0 rounded-full',
            dotStyles[variant],
            dotSizeStyles[size],
          )}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}
