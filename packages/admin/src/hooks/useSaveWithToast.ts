import { useCallback, useRef, useState } from 'react';
import { useToast } from './useToast';

/**
 * Wraps an async save function with toast notifications.
 *
 * Shows a success toast when the save completes and an error toast
 * if it throws. Tracks the in-flight state via a `saving` boolean.
 * After a successful save, `saveSuccess` is `true` for 600ms to
 * drive the warm amber/gold pulse animation on the save button.
 *
 * @param saveFn - Async function that performs the save operation.
 * @param options - Optional custom messages for success/error toasts.
 * @returns `{ save, saving, saveSuccess }` — trigger function, loading flag, and transient success flag.
 *
 * @example
 * ```tsx
 * const { save, saving, saveSuccess } = useSaveWithToast(
 *   () => patchConfig(config, updates),
 *   { successMessage: 'Config saved', errorMessage: 'Save failed' }
 * );
 *
 * <Button
 *   onClick={save}
 *   loading={saving}
 *   className={saveSuccess ? 'animate-save-success' : ''}
 * >
 *   Save
 * </Button>
 * ```
 */
export function useSaveWithToast(
  saveFn: () => Promise<void>,
  options?: { successMessage?: string; errorMessage?: string },
) {
  const { success, error } = useToast();
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await saveFn();
      success(options?.successMessage ?? 'Saved', 'Changes applied successfully');

      // Clear any existing timer to avoid stale state
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
      }

      // Set transient success flag for 600ms (matches animation duration)
      setSaveSuccess(true);
      successTimerRef.current = setTimeout(() => {
        setSaveSuccess(false);
        successTimerRef.current = null;
      }, 600);
    } catch (err) {
      const description =
        err instanceof Error ? err.message : 'An unexpected error occurred';
      error(options?.errorMessage ?? 'Save failed', description);
    } finally {
      setSaving(false);
    }
  }, [saveFn, success, error, options?.successMessage, options?.errorMessage]);

  return { save, saving, saveSuccess };
}
