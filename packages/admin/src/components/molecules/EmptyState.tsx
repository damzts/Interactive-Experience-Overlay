import { type ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { Button } from '../atoms/Button';

/**
 * EmptyState molecule component for the IEOM Admin Panel design system.
 *
 * Displays a centered placeholder with an optional icon/illustration,
 * title, description, and action button when a section has no configured
 * items. Uses muted colors and generous spacing to draw attention without
 * overwhelming the layout.
 *
 * @example
 * ```tsx
 * <EmptyState
 *   icon={<Layers className="h-full w-full" />}
 *   title="No widgets configured"
 *   description="Add your first widget to get started."
 *   actionLabel="Add Widget"
 *   onAction={() => openWidgetDialog()}
 * />
 * ```
 */

export interface EmptyStateProps {
  /** Large icon or illustration rendered in the muted icon area */
  icon?: ReactNode;
  /** Main heading text describing the empty state */
  title: string;
  /** Optional supporting description with guidance or context */
  description?: string;
  /** Label for the optional call-to-action button */
  actionLabel?: string;
  /** Click handler for the action button */
  onAction?: () => void;
  /** Additional CSS classes for the root container */
  className?: string;
}

/**
 * Renders a centered empty state with icon, title, description,
 * and an optional primary action button.
 */
export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        'px-[var(--space-6)] py-[var(--space-16)]',
        className,
      )}
    >
      {icon && (
        <div
          className={cn(
            'flex items-center justify-center',
            'h-16 w-16 mb-[var(--space-6)]',
            'rounded-[var(--radius-xl)]',
            'bg-[var(--color-bg-elevated)]',
            'text-[var(--color-text-muted)]',
            '[&>svg]:h-8 [&>svg]:w-8',
          )}
          aria-hidden="true"
        >
          {icon}
        </div>
      )}

      <h3
        className={cn(
          'text-[var(--text-lg)] font-medium',
          'text-[var(--color-text-primary)]',
          'mb-[var(--space-2)]',
        )}
      >
        {title}
      </h3>

      {description && (
        <p
          className={cn(
            'text-[var(--text-sm)]',
            'text-[var(--color-text-muted)]',
            'max-w-xs',
            'mb-[var(--space-6)]',
          )}
        >
          {description}
        </p>
      )}

      {actionLabel && onAction && (
        <Button variant="primary" size="md" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
