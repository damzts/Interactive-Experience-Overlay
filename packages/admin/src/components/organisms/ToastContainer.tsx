import { createPortal } from 'react-dom';
import { cn } from '../../utils/cn';
import { Toast } from '../molecules/Toast';

/**
 * ToastContainer organism for the IEOM Admin Panel design system.
 *
 * Renders a stack of toast notifications via a React portal attached to
 * `document.body`. The container is fixed-positioned in the top-right corner
 * with a high z-index to float above all other content. Each toast is rendered
 * using the Toast molecule and stacks vertically with gap spacing.
 *
 * An `aria-live="polite"` region ensures screen readers announce new toasts
 * without interrupting the current task.
 *
 * @example
 * ```tsx
 * <ToastContainer
 *   toasts={[
 *     { id: '1', type: 'success', title: 'Config saved' },
 *     { id: '2', type: 'error', title: 'Connection lost', description: 'Retrying...' },
 *   ]}
 *   onDismiss={(id) => removeToast(id)}
 * />
 * ```
 */

export interface ToastContainerProps {
  /** Array of toast items to display in the stack */
  toasts: Array<{
    id: string;
    type: 'success' | 'error' | 'info' | 'warning';
    title: string;
    description?: string;
    duration?: number;
  }>;
  /** Callback invoked when a toast should be dismissed */
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return createPortal(
    <div
      aria-live="polite"
      aria-atomic="false"
      className={cn(
        'fixed top-[var(--space-4)] right-[var(--space-4)]',
        'z-[9999]',
        'flex flex-col gap-[var(--space-3)]',
        'pointer-events-none',
        'w-[var(--toast-container-width,360px)] max-w-[calc(100vw-var(--space-8))]',
      )}
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast
            id={toast.id}
            type={toast.type}
            title={toast.title}
            description={toast.description}
            duration={toast.duration}
            onDismiss={onDismiss}
          />
        </div>
      ))}
    </div>,
    document.body,
  );
}

ToastContainer.displayName = 'ToastContainer';
