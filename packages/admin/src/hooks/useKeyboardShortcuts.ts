import { useEffect } from 'react';

/**
 * Handler callbacks for global keyboard shortcuts.
 *
 * Each handler is optional — only shortcuts with a registered handler will
 * be active. Handlers are called with `preventDefault()` already invoked
 * where appropriate (all shortcuts except Escape).
 */
export interface KeyboardShortcutHandlers {
  /** Ctrl+K / Cmd+K — Open search / command palette */
  onSearch?: () => void;
  /** Ctrl+S / Cmd+S — Save current configuration */
  onSave?: () => void;
  /** Escape — Close active modal or panel */
  onEscape?: () => void;
  /** Ctrl+1‑6 / Cmd+1‑6 — Navigate to section by index (1-based) */
  onNavigateSection?: (index: number) => void;
}

/**
 * Returns `true` when the event target is an element where the user is
 * actively typing (input, textarea, or contenteditable).
 */
function isTypingTarget(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  if (!target) return false;

  const tagName = target.tagName.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea') return true;
  if (target.isContentEditable) return true;

  return false;
}

/**
 * Attaches global keyboard shortcut listeners to `document`.
 *
 * Supported shortcuts:
 * - **Ctrl+K** (Cmd+K on Mac): triggers `onSearch`
 * - **Ctrl+S** (Cmd+S on Mac): triggers `onSave`
 * - **Escape**: triggers `onEscape`
 * - **Ctrl+1–6** (Cmd+1–6 on Mac): triggers `onNavigateSection(1–6)`
 *
 * Shortcuts are suppressed when the user is focused on an input, textarea,
 * or contenteditable element to avoid interfering with normal text entry.
 *
 * The listener is cleaned up automatically on unmount.
 *
 * @param handlers - Object containing optional callback functions for each shortcut.
 *
 * @example
 * ```tsx
 * useKeyboardShortcuts({
 *   onSearch: () => setCommandPaletteOpen(true),
 *   onSave: () => saveConfig(),
 *   onEscape: () => closeModal(),
 *   onNavigateSection: (index) => navigateTo(sections[index - 1]),
 * });
 * ```
 */
export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers): void {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      // Don't fire shortcuts when user is typing in an input field
      if (isTypingTarget(event)) return;

      const modifier = event.metaKey || event.ctrlKey;

      // Ctrl+K / Cmd+K — Search
      if (modifier && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        handlers.onSearch?.();
        return;
      }

      // Ctrl+S / Cmd+S — Save
      if (modifier && event.key.toLowerCase() === 's') {
        event.preventDefault();
        handlers.onSave?.();
        return;
      }

      // Escape — Close modal/panel
      if (event.key === 'Escape') {
        handlers.onEscape?.();
        return;
      }

      // Ctrl+1 through Ctrl+6 — Section navigation
      if (modifier && event.key >= '1' && event.key <= '6') {
        event.preventDefault();
        const index = parseInt(event.key, 10);
        handlers.onNavigateSection?.(index);
        return;
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handlers]);
}
