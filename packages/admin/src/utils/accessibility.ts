/**
 * Selector for elements that are natively focusable or have an explicit tabindex.
 */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Returns all focusable elements within a container that are visible and not disabled.
 * Elements with `display: none`, `visibility: hidden`, or `[hidden]` are excluded.
 *
 * @param container - The DOM element to search within
 * @returns An array of focusable HTMLElements in DOM order
 *
 * @example
 * const focusable = getFocusableElements(dialogRef.current);
 * focusable[0]?.focus();
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const elements = Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  );

  return elements.filter((el) => {
    if (el.hasAttribute('hidden')) return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  });
}

/**
 * Traps keyboard focus within a container element. Tab and Shift+Tab wrap
 * around at the boundaries so focus never leaves the container.
 *
 * Returns a cleanup function that removes the event listener.
 *
 * @param container - The DOM element to trap focus within
 * @returns A cleanup function to remove the focus trap
 *
 * @example
 * const cleanup = trapFocus(modalElement);
 * // Later, when the modal closes:
 * cleanup();
 */
export function trapFocus(container: HTMLElement): () => void {
  function handleKeyDown(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;

    const focusable = getFocusableElements(container);
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey) {
      // Shift+Tab: wrap from first to last
      if (document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    } else {
      // Tab: wrap from last to first
      if (document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  container.addEventListener('keydown', handleKeyDown);

  return () => {
    container.removeEventListener('keydown', handleKeyDown);
  };
}

/**
 * Announces a message to screen readers by creating a temporary aria-live region.
 * The region is removed from the DOM after the message has been announced.
 *
 * @param message - The text to announce
 * @param priority - The urgency level: 'polite' (default) waits for idle, 'assertive' interrupts
 *
 * @example
 * announceToScreenReader('Configuration saved successfully');
 * announceToScreenReader('Connection lost', 'assertive');
 */
export function announceToScreenReader(
  message: string,
  priority: 'polite' | 'assertive' = 'polite'
): void {
  const region = document.createElement('div');
  region.setAttribute('aria-live', priority);
  region.setAttribute('aria-atomic', 'true');
  region.setAttribute('role', priority === 'assertive' ? 'alert' : 'status');

  // Visually hidden but accessible to screen readers
  Object.assign(region.style, {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: '0',
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    border: '0',
  });

  document.body.appendChild(region);

  // Delay setting text content so the live region is registered first
  requestAnimationFrame(() => {
    region.textContent = message;
  });

  // Remove after sufficient time for screen readers to pick up the announcement
  setTimeout(() => {
    region.remove();
  }, 1000);
}

/** Counter for generating unique IDs within a session. */
let idCounter = 0;

/**
 * Generates a unique ID string suitable for ARIA relationship attributes
 * such as `aria-labelledby` and `aria-describedby`.
 *
 * @param prefix - Optional prefix for the generated ID (defaults to 'aria')
 * @returns A unique string ID
 *
 * @example
 * const labelId = generateId('tooltip'); // 'tooltip-1'
 * const descId = generateId();           // 'aria-2'
 */
export function generateId(prefix: string = 'aria'): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}
