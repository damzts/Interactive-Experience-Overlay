import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../utils/cn';

/**
 * Input atom component for the IEOM Admin Panel design system.
 *
 * Supports three sizes (sm, md, lg), an error state with optional message,
 * prefix/suffix icon slots, and full ARIA accessibility. All colors reference
 * CSS custom properties from the design token system.
 *
 * @example
 * ```tsx
 * <Input
 *   size="md"
 *   placeholder="Enter scene name..."
 *   prefixIcon={<Search />}
 *   error
 *   errorMessage="Name is required"
 * />
 * ```
 */

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Size preset controlling padding and font size */
  size: 'sm' | 'md' | 'lg';
  /** Displays error styling (red border) and sets aria-invalid */
  error?: boolean;
  /** Error message displayed below the input */
  errorMessage?: string;
  /** Icon element rendered at the start of the input */
  prefixIcon?: ReactNode;
  /** Icon element rendered at the end of the input */
  suffixIcon?: ReactNode;
  /** When true, applies accent border color to indicate unsaved changes */
  dirty?: boolean;
}

const sizeStyles: Record<InputProps['size'], string> = {
  sm: 'h-8 text-xs rounded-[var(--radius-sm)]',
  md: 'h-10 text-sm rounded-[var(--radius-md)]',
  lg: 'h-12 text-base rounded-[var(--radius-lg)]',
};

const paddingStyles: Record<InputProps['size'], { base: string; prefix: string; suffix: string }> = {
  sm: { base: 'px-2.5', prefix: 'pl-7', suffix: 'pr-7' },
  md: { base: 'px-3', prefix: 'pl-9', suffix: 'pr-9' },
  lg: { base: 'px-4', prefix: 'pl-11', suffix: 'pr-11' },
};

const iconSizeStyles: Record<InputProps['size'], string> = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
};

const iconPositionStyles: Record<InputProps['size'], { prefix: string; suffix: string }> = {
  sm: { prefix: 'left-2', suffix: 'right-2' },
  md: { prefix: 'left-3', suffix: 'right-3' },
  lg: { prefix: 'left-3.5', suffix: 'right-3.5' },
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      size,
      error = false,
      dirty = false,
      errorMessage,
      prefixIcon,
      suffixIcon,
      className,
      id,
      'aria-describedby': ariaDescribedBy,
      ...rest
    },
    ref,
  ) => {
    const errorId = errorMessage && id ? `${id}-error` : undefined;
    const describedBy = [ariaDescribedBy, errorId].filter(Boolean).join(' ') || undefined;

    return (
      <div className="w-full">
        <div className="relative">
          {prefixIcon && (
            <span
              className={cn(
                'absolute top-1/2 -translate-y-1/2 pointer-events-none',
                'text-[var(--color-text-muted)]',
                iconPositionStyles[size].prefix,
              )}
              aria-hidden="true"
            >
              <span className={cn('inline-flex', iconSizeStyles[size], '[&>svg]:h-full [&>svg]:w-full')}>
                {prefixIcon}
              </span>
            </span>
          )}

          <input
            ref={ref}
            id={id}
            className={cn(
              // Base styles
              'w-full border outline-none',
              'bg-[var(--color-bg-surface)]',
              'text-[var(--color-text-primary)]',
              'placeholder:text-[var(--color-text-muted)]',
              'transition-all duration-[var(--duration-fast)] ease-[var(--ease-default)]',
              // Default border
              !error && !dirty && 'border-[var(--color-border-default)]',
              // Dirty state border (unsaved changes)
              !error && dirty && 'border-[var(--color-accent-400)]',
              // Focus state
              !error && [
                'focus:border-[var(--color-primary-500)]',
                'focus:ring-2 focus:ring-[var(--color-primary-400)]/25',
              ],
              // Error state
              error && [
                'border-[var(--color-danger-500)]',
                'focus:border-[var(--color-danger-500)]',
                'focus:ring-2 focus:ring-[var(--color-danger-400)]/25',
              ],
              // Disabled state
              'disabled:opacity-50 disabled:cursor-not-allowed',
              // Size
              sizeStyles[size],
              // Padding (adjusted for icons)
              prefixIcon ? paddingStyles[size].prefix : paddingStyles[size].base,
              suffixIcon ? paddingStyles[size].suffix : '',
              className,
            )}
            aria-invalid={error || undefined}
            aria-describedby={describedBy}
            {...rest}
          />

          {suffixIcon && (
            <span
              className={cn(
                'absolute top-1/2 -translate-y-1/2 pointer-events-none',
                'text-[var(--color-text-muted)]',
                iconPositionStyles[size].suffix,
              )}
              aria-hidden="true"
            >
              <span className={cn('inline-flex', iconSizeStyles[size], '[&>svg]:h-full [&>svg]:w-full')}>
                {suffixIcon}
              </span>
            </span>
          )}
        </div>

        {error && errorMessage && (
          <p
            id={errorId}
            className="mt-1.5 text-xs text-[var(--color-danger-400)]"
            role="alert"
          >
            {errorMessage}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
