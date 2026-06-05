import { useEffect, type FC } from 'react';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import { cn } from '../../utils/cn';

/**
 * Toast molecule component for the IEOM Admin Panel design system.
 *
 * Displays a notification message with type-based styling (success, error,
 * info, warning), an auto-dismiss timer, and a manual close button. Each
 * type renders a distinct left border color and icon for quick visual
 * identification.
 *
 * Uses the `animate-toast-enter` class from animations.css for a slide-in
 * entrance from the right edge. Auto-dismisses after `duration` milliseconds
 * (default 3000ms) by calling `onDismiss` with the toast `id`.
 *
 * @example
 * ```tsx
 * <Toast
 *   id="toast-1"
 *   type="success"
 *   title="Config saved"
 *   description="Your changes have been applied."
 *   onDismiss={(id) => removeToast(id)}
 * />
 * ```
 */

export interface ToastProps {
  /** Unique identifier for this toast instance */
  id: string;
  /** Semantic type controlling icon and color styling */
  type: 'success' | 'error' | 'info' | 'warning';
  /** Primary message text */
  title: string;
  /** Optional secondary description text */
  description?: string;
  /** Auto-dismiss delay in milliseconds (default 3000) */
  duration?: number;
  /** Callback invoked when the toast should be removed */
  onDismiss: (id: string) => void;
}

const typeConfig: Record<
  ToastProps['type'],
  { borderClass: string; iconClass: string; Icon: typeof CheckCircle }
> = {
  success: {
    borderClass: 'border-l-[var(--color-success-500)]',
    iconClass: 'text-[var(--color-success-400)]',
    Icon: CheckCircle,
  },
  error: {
    borderClass: 'border-l-[var(--color-danger-500)]',
    iconClass: 'text-[var(--color-danger-400)]',
    Icon: XCircle,
  },
  info: {
    borderClass: 'border-l-[var(--color-primary-500)]',
    iconClass: 'text-[var(--color-primary-400)]',
    Icon: Info,
  },
  warning: {
    borderClass: 'border-l-[var(--color-accent-500)]',
    iconClass: 'text-[var(--color-accent-400)]',
    Icon: AlertTriangle,
  },
};

export const Toast: FC<ToastProps> = ({
  id,
  type,
  title,
  description,
  duration = 3000,
  onDismiss,
}) => {
  const { borderClass, iconClass, Icon } = typeConfig[type];

  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(id);
    }, duration);

    return () => clearTimeout(timer);
  }, [id, duration, onDismiss]);

  return (
    <div
      role="alert"
      className={cn(
        // Layout
        'relative flex items-start gap-[var(--space-3)] p-[var(--space-4)] pr-[var(--space-10)]',
        // Background & border
        'bg-[var(--color-bg-elevated)]',
        'border border-[var(--color-border-default)]',
        'border-l-[3px]',
        borderClass,
        // Elevation & shape
        'shadow-[var(--shadow-md)]',
        'rounded-[var(--radius-md)]',
        // Entrance animation
        'animate-toast-enter',
      )}
    >
      {/* Type icon */}
      <Icon className={cn('h-5 w-5 shrink-0 mt-0.5', iconClass)} aria-hidden="true" />

      {/* Content */}
      <div className="flex flex-col gap-0.5 min-w-0">
        <p className="text-[var(--text-sm)] font-medium text-[var(--color-text-primary)] leading-tight">
          {title}
        </p>
        {description && (
          <p className="text-[var(--text-xs)] text-[var(--color-text-secondary)] leading-snug">
            {description}
          </p>
        )}
      </div>

      {/* Close button */}
      <button
        type="button"
        onClick={() => onDismiss(id)}
        className={cn(
          'absolute top-[var(--space-2)] right-[var(--space-2)]',
          'inline-flex items-center justify-center',
          'h-6 w-6 rounded-[var(--radius-sm)]',
          'text-[var(--color-danger-400)]',
          'hover:text-[var(--color-danger-300)]',
          'hover:bg-[var(--color-danger-500)]/10',
          'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-default)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-400)]',
        )}
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
};

Toast.displayName = 'Toast';
