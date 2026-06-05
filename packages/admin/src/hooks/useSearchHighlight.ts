import { useCallback } from 'react';

const HIGHLIGHT_CLASS = 'animate-highlight-flash';
const HIGHLIGHT_DURATION_MS = 1000;

/**
 * Provides a utility function to highlight a target element after search navigation.
 *
 * When `highlightElement` is called with an element ID, it locates the DOM element
 * by its `data-section-id` attribute, smoothly scrolls it into view, and applies
 * the `animate-highlight-flash` CSS class for a 1-second background-color pulse.
 * The class is automatically removed after the animation completes.
 *
 * @returns An object containing the `highlightElement` function
 *
 * @example
 * ```tsx
 * const { highlightElement } = useSearchHighlight();
 *
 * function handleNavigate(id: string) {
 *   setActiveSection(id);
 *   highlightElement(id);
 * }
 * ```
 */
export function useSearchHighlight() {
  const highlightElement = useCallback((elementId: string): void => {
    const el = document.querySelector<HTMLElement>(
      `[data-section-id="${elementId}"]`,
    );

    if (!el) return;

    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // Remove class first in case it's already applied (e.g. rapid re-selection)
    el.classList.remove(HIGHLIGHT_CLASS);

    // Force a reflow so re-adding the class restarts the animation
    void el.offsetWidth;

    el.classList.add(HIGHLIGHT_CLASS);

    setTimeout(() => {
      el.classList.remove(HIGHLIGHT_CLASS);
    }, HIGHLIGHT_DURATION_MS);
  }, []);

  return { highlightElement };
}
