import { useState, useCallback } from 'react';

/**
 * Persists a value in `localStorage` with the same API as `useState`.
 *
 * Reads the stored JSON value on mount, falling back to `initialValue` when
 * the key does not exist or the stored value cannot be parsed. Writes to
 * `localStorage` whenever the value is updated via the returned setter.
 *
 * Handles SSR gracefully by skipping `localStorage` access when `window`
 * is undefined.
 *
 * @param key - The localStorage key to read/write.
 * @param initialValue - Fallback value used when no stored value exists.
 * @returns A stateful value and a setter function (supports updater callbacks).
 *
 * @example
 * ```ts
 * const [collapsed, setCollapsed] = useLocalStorage('sidebar-collapsed', false);
 * const [dismissed, setDismissed] = useLocalStorage('onboarding-dismissed', false);
 * ```
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;

    try {
      const item = window.localStorage.getItem(key);
      return item !== null ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue((current) => {
        const nextValue =
          value instanceof Function ? value(current) : value;

        if (typeof window !== 'undefined') {
          try {
            window.localStorage.setItem(key, JSON.stringify(nextValue));
          } catch {
            // Silently fail on quota exceeded or other write errors
          }
        }

        return nextValue;
      });
    },
    [key],
  );

  return [storedValue, setValue];
}
