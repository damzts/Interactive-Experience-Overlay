import { useCallback } from 'react';
import { useAdminStore } from '../store/useAdminStore';

/**
 * Convenience hook for managing toast notifications.
 *
 * Provides direct access to the toast queue and shorthand helpers
 * for dispatching typed toasts (success, error, info, warning).
 *
 * @example
 * ```tsx
 * const { success, error } = useToast();
 * success('Saved', 'Config updated successfully');
 * error('Failed to connect');
 * ```
 */
export function useToast() {
  const toasts = useAdminStore((s) => s.toasts);
  const addToast = useAdminStore((s) => s.addToast);
  const removeToast = useAdminStore((s) => s.removeToast);

  const success = useCallback(
    (title: string, description?: string) => {
      addToast({ type: 'success', title, description });
    },
    [addToast],
  );

  const error = useCallback(
    (title: string, description?: string) => {
      addToast({ type: 'error', title, description });
    },
    [addToast],
  );

  const info = useCallback(
    (title: string, description?: string) => {
      addToast({ type: 'info', title, description });
    },
    [addToast],
  );

  const warning = useCallback(
    (title: string, description?: string) => {
      addToast({ type: 'warning', title, description });
    },
    [addToast],
  );

  return { toasts, addToast, removeToast, success, error, info, warning };
}
