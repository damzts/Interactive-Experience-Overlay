import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../utils/cn';

/**
 * Button atom component for the IEOM Admin Panel design system.
 *
 * Supports five semantic variants (primary, secondary, ghost, danger, success),
 * three sizes (sm, md, lg), a loading state with spinner, and optional icon
 * placement on either side of the label text.
 *
 * All colors reference CSS custom properties from the design token system.
 * Includes a press animation (active:scale-[0.97]) for tactile feedback.
 *
 * @example
 * ```tsx
 * <Button variant="primary" size="md" icon={<Save />}>
 *   Save Changes
 * </Button>
 * ```
 */

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Visual style variant */
  variant: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  /** Size preset controlling padding and font size */
  size: 'sm' | 'md' | 'lg';
  /** Shows a loading spinner and disables interaction */
  loading?: boolean;
  /** Icon element to render alongside the label */
  icon?: ReactNode;
  /** Position of the icon relative to the label text */
  iconPosition?: 'left' | 'right';
  /** Stretch to fill the parent container width */
  fullWidth?: boolean;
  /** Button label content */
  children: ReactNode;
}

const variantStyles: Record<ButtonProps['variant'], string> = {
  primary: [
    'bg-[var(--color-primary-500)]',
    'hover:bg-[var(--color-primary-600)]',
    'text-white',
    'shadow-[var(--shadow-sm)]',
    'hover:shadow-[var(--shadow-md)]',
  ].join(' '),
  secondary: [
    'bg-[var(--color-bg-elevated)]',
    'border',
    'border-[var(--color-border-strong)]',
    'text-[var(--color-text-primary)]',
    'hover:bg-[var(--color-bg-surface)]',
    'hover:border-[var(--color-primary-400)]/30',
  ].join(' '),
  ghost: [
    'bg-transparent',
    'text-[var(--color-text-secondary)]',
    'hover:bg-[var(--color-bg-elevated)]',
    'hover:text-[var(--color-text-primary)]',
  ].join(' '),
  danger: [
    'bg-[var(--color-danger-500)]',
    'hover:bg-[var(--color-danger-600)]',
    'text-white',
    'shadow-[var(--shadow-sm)]',
    'hover:shadow-[var(--shadow-md)]',
  ].join(' '),
  success: [
    'bg-[var(--color-success-500)]',
    'hover:bg-[var(--color-success-600)]',
    'text-white',
    'shadow-[var(--shadow-sm)]',
    'hover:shadow-[var(--shadow-md)]',
  ].join(' '),
};

const sizeStyles: Record<ButtonProps['size'], string> = {
  sm: 'px-3 py-1.5 text-xs gap-1.5 rounded-[var(--radius-sm)]',
  md: 'px-4 py-2 text-sm gap-2 rounded-[var(--radius-md)]',
  lg: 'px-6 py-3 text-base gap-2.5 rounded-[var(--radius-lg)]',
};

/** Loading spinner SVG rendered when `loading` is true. */
function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn('animate-spin', className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant,
      size,
      loading = false,
      icon,
      iconPosition = 'left',
      fullWidth = false,
      children,
      disabled,
      className,
      onClick,
      ...rest
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';

    const iconElement = loading ? (
      <Spinner className={iconSize} />
    ) : icon ? (
      <span className={cn('inline-flex shrink-0', iconSize, '[&>svg]:h-full [&>svg]:w-full')}>
        {icon}
      </span>
    ) : null;

    return (
      <button
        ref={ref}
        type="button"
        disabled={isDisabled}
        onClick={isDisabled ? undefined : onClick}
        className={cn(
          // Base styles
          'inline-flex items-center justify-center font-medium',
          'transition-all duration-[var(--duration-fast)] ease-[var(--ease-default)]',
          'select-none whitespace-nowrap',
          // Press animation
          'active:scale-[0.97]',
          // Focus ring
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-400)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-base)]',
          // Disabled state
          'disabled:pointer-events-none disabled:opacity-50',
          // Variant & size
          variantStyles[variant],
          sizeStyles[size],
          // Full width
          fullWidth && 'w-full',
          // Loading cursor
          loading && 'cursor-wait',
          className,
        )}
        aria-busy={loading || undefined}
        {...rest}
      >
        {iconPosition === 'left' && iconElement}
        <span>{children}</span>
        {iconPosition === 'right' && iconElement}
      </button>
    );
  },
);

Button.displayName = 'Button';
