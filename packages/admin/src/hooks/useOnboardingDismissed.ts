import { useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';

/**
 * Tracks whether the user has permanently dismissed the onboarding tour.
 *
 * Uses `localStorage` (key: `ieom-onboarding-dismissed`) so the preference
 * survives page reloads and browser sessions. Once `dismiss()` is called the
 * tour will not be shown again unless the stored value is manually cleared.
 *
 * @returns A tuple `[dismissed, dismiss]` where `dismissed` is the current
 * boolean state and `dismiss` is a stable callback that sets it to `true`.
 *
 * @example
 * ```tsx
 * const [dismissed, dismiss] = useOnboardingDismissed();
 * <WelcomeTour open={!dismissed} onDismiss={dismiss} />
 * ```
 */
export function useOnboardingDismissed(): [boolean, () => void] {
  const [dismissed, setDismissed] = useLocalStorage<boolean>(
    'ieom-onboarding-dismissed',
    false,
  );

  const dismiss = useCallback(() => {
    setDismissed(true);
  }, [setDismissed]);

  return [dismissed, dismiss];
}
