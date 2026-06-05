import { useId } from 'react';
import { cn } from '../../utils/cn';
import { Input, Tooltip } from '../atoms';
import type { InputProps } from '../atoms/Input';

/**
 * Field molecule component for the IEOM Admin Panel design system.
 *
 * Composes a label, the Input atom, an optional error message, and an
 * optional tooltip hint into a complete form field. Auto-generates an
 * accessible `id` linking the label to the input when one is not provided.
 *
 * @example
 * ```tsx
 * <Field
 *   label="Scene Name"
 *   hint="A unique name used to identify this scene in the overlay"
 *   error="Name is required"
 *   required
 *   size="md"
 *   placeholder="Enter scene name..."
 * />
 * ```
 */

export interface FieldProps extends Omit<InputProps, 'id' | 'error' | 'errorMessage'> {
  /** Text label displayed above the input */
  label: string;
  /** Optional tooltip hint shown via a "?" icon next to the label */
  hint?: string;
  /** Error message displayed below the input; presence implies error state */
  error?: string;
  /** Whether the field is required (shows a visual indicator on the label) */
  required?: boolean;
  /** HTML id for the input element; auto-generated if not provided */
  id?: string;
}

export function Field({
  label,
  hint,
  error,
  required,
  id: externalId,
  className,
  ...inputProps
}: FieldProps) {
  const generatedId = useId();
  const fieldId = externalId ?? generatedId;
  const errorId = error ? `${fieldId}-error` : undefined;

  return (
    <div className={cn('flex flex-col gap-[var(--space-1)]', className)}>
      <div className="flex items-center gap-[var(--space-1)]">
        <label
          htmlFor={fieldId}
          className={cn(
            'text-[var(--text-sm)] font-medium',
            'text-[var(--color-text-secondary)]',
          )}
        >
          {label}
          {required && (
            <span
              className="ml-0.5 text-[var(--color-danger-400)]"
              aria-hidden="true"
            >
              *
            </span>
          )}
        </label>

        {hint && (
          <Tooltip content={hint} position="top">
            <button
              type="button"
              className={cn(
                'inline-flex items-center justify-center',
                'h-4 w-4 rounded-full',
                'text-[10px] font-bold leading-none',
                'bg-[var(--color-bg-elevated)]',
                'text-[var(--color-text-muted)]',
                'hover:text-[var(--color-text-secondary)]',
                'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-default)]',
                'focus-visible:outline-none focus-visible:ring-2',
                'focus-visible:ring-[var(--color-primary-400)]/50',
              )}
              aria-label={`Hint: ${hint}`}
              tabIndex={0}
            >
              ?
            </button>
          </Tooltip>
        )}
      </div>

      <Input
        {...inputProps}
        id={fieldId}
        error={!!error}
        errorMessage={error}
        aria-describedby={errorId}
        aria-required={required || undefined}
      />
    </div>
  );
}
