import { cn } from '../../utils/cn';

/**
 * StatusIndicator molecule for the IEOM Admin Panel design system.
 *
 * Displays a small color-coded dot alongside a text label to communicate
 * connection or system state at a glance. The dot uses CSS custom property
 * colors from the design token system and applies a subtle pulse animation
 * for active states (connected, loading).
 *
 * Status color mapping:
 * - `connected` — green (--color-success-400) with pulse animation
 * - `disconnected` — red (--color-danger-400) static
 * - `warning` — amber (--color-accent-400) static
 * - `loading` — cyan (--color-primary-400) with pulse animation
 *
 * @example
 * ```tsx
 * <StatusIndicator status="connected" label="WebSocket" />
 * <StatusIndicator status="disconnected" label="OBS Studio" />
 * <StatusIndicator status="loading" label="Connecting..." />
 * ```
 */

export type StatusIndicatorStatus = 'connected' | 'disconnected' | 'warning' | 'loading';

export interface StatusIndicatorProps {
  /** Current connection/system state */
  status: StatusIndicatorStatus;
  /** Descriptive text displayed next to the dot */
  label: string;
  /** Additional CSS class names */
  className?: string;
}

const dotColorStyles: Record<StatusIndicatorStatus, string> = {
  connected: 'bg-[var(--color-success-400)]',
  disconnected: 'bg-[var(--color-danger-400)]',
  warning: 'bg-[var(--color-accent-400)]',
  loading: 'bg-[var(--color-primary-400)]',
};

const dotTextColors: Record<StatusIndicatorStatus, string> = {
  connected: 'text-[var(--color-success-400)]',
  disconnected: 'text-[var(--color-danger-400)]',
  warning: 'text-[var(--color-accent-400)]',
  loading: 'text-[var(--color-primary-400)]',
};

const animatedStatuses: Set<StatusIndicatorStatus> = new Set(['connected', 'loading']);

/**
 * Renders a color-coded status dot with a text label.
 */
export function StatusIndicator({ status, label, className }: StatusIndicatorProps) {
  const shouldAnimate = animatedStatuses.has(status);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-[var(--space-2)]',
        className,
      )}
      role="status"
      aria-label={`${label}: ${status}`}
    >
      <span
        className={cn(
          'relative inline-block h-2 w-2 rounded-full',
          dotColorStyles[status],
          shouldAnimate && dotTextColors[status],
          shouldAnimate && 'animate-pulse-ring',
        )}
        aria-hidden="true"
      />
      <span className="text-[var(--text-sm)] leading-none text-[var(--color-text-secondary)]">
        {label}
      </span>
    </span>
  );
}
