import { useState, useCallback } from 'react';
import type { NavSection } from './useSearch';
import { useSearch } from './useSearch';

/**
 * Integration hook that manages the Command Palette lifecycle.
 *
 * Combines open/close state management with the `useSearch` hook to provide
 * a single interface for rendering the `CommandPalette` component. The returned
 * `open` function can be passed directly to `TopBar`'s `onSearchOpen` prop and
 * to `useKeyboardShortcuts`'s `onSearch` handler to wire up the Ctrl+K shortcut.
 *
 * @param params - Configuration object
 * @param params.sections - Sidebar navigation sections used to build the search index
 * @param params.onNavigate - Callback invoked when a search result is selected (receives the item id)
 *
 * @returns Object containing all props needed to render `CommandPalette`, plus `open`/`close` controls
 *
 * @example
 * ```tsx
 * const commandPalette = useCommandPalette({ sections, onNavigate });
 *
 * useKeyboardShortcuts({ onSearch: commandPalette.open, onEscape: commandPalette.close });
 *
 * <TopBar onSearchOpen={commandPalette.open} />
 * <CommandPalette
 *   open={commandPalette.isOpen}
 *   onClose={commandPalette.close}
 *   onSelect={commandPalette.handleSelect}
 *   query={commandPalette.query}
 *   onQueryChange={commandPalette.setQuery}
 *   results={commandPalette.results}
 *   recentSearches={commandPalette.recentSearches}
 *   onRecentSelect={commandPalette.handleRecentSelect}
 * />
 * ```
 */
export function useCommandPalette(params: {
  sections: NavSection[];
  onNavigate: (id: string) => void;
}) {
  const { sections, onNavigate } = params;
  const [isOpen, setIsOpen] = useState(false);

  const { query, results, recentSearches, performSearch, addRecentSearch } =
    useSearch(sections);

  /** Open the command palette */
  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  /** Close the command palette and reset the query */
  const close = useCallback(() => {
    setIsOpen(false);
    performSearch('');
  }, [performSearch]);

  /** Update the search query (delegates to performSearch internally) */
  const setQuery = useCallback(
    (q: string) => {
      performSearch(q);
    },
    [performSearch],
  );

  /**
   * Handle selection of a search result.
   * Records the current query as a recent search, navigates to the item, and closes the palette.
   */
  const handleSelect = useCallback(
    (id: string) => {
      if (query.trim()) {
        addRecentSearch(query);
      }
      onNavigate(id);
      close();
    },
    [query, addRecentSearch, onNavigate, close],
  );

  /**
   * Handle selection of a recent search entry.
   * Sets the query and performs the search so results are displayed immediately.
   */
  const handleRecentSelect = useCallback(
    (recentQuery: string) => {
      performSearch(recentQuery);
    },
    [performSearch],
  );

  return {
    isOpen,
    open,
    close,
    query,
    setQuery,
    results,
    recentSearches,
    handleSelect,
    handleRecentSelect,
  };
}
