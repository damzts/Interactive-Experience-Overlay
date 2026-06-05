import { useEffect, useRef, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, Clock } from 'lucide-react';
import { cn } from '../../utils/cn';
import { trapFocus } from '../../utils/accessibility';
import { SearchResult } from '../molecules/SearchResult';

/**
 * CommandPalette organism component for the IEOM Admin Panel design system.
 *
 * Renders a full-screen overlay with a centered search panel via React portal.
 * Supports fuzzy search results grouped by category, keyboard navigation
 * (ArrowUp/ArrowDown to move selection, Enter to select, Escape to close),
 * and displays recent searches when the query is empty.
 *
 * Opens within 100ms of trigger (Ctrl+K or search icon click). Focus is
 * trapped within the palette while open and returned to the trigger element
 * on close.
 *
 * @example
 * ```tsx
 * <CommandPalette
 *   open={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   onSelect={(id) => navigateTo(id)}
 *   query={query}
 *   onQueryChange={setQuery}
 *   results={searchResults}
 *   recentSearches={recents}
 *   onRecentSelect={(q) => setQuery(q)}
 * />
 * ```
 */

export interface CommandPaletteProps {
  /** Whether the command palette is currently visible */
  open: boolean;
  /** Callback invoked when the palette should close */
  onClose: () => void;
  /** Callback invoked when a result item is selected */
  onSelect: (itemId: string) => void;
  /** Current search query string */
  query: string;
  /** Callback invoked when the search query changes */
  onQueryChange: (query: string) => void;
  /** Search results with score and match indices */
  results: Array<{
    item: { id: string; label: string; category: string; path?: string };
    score: number;
    matchIndices: number[];
  }>;
  /** List of recent search queries (last 5) */
  recentSearches: string[];
  /** Callback invoked when a recent search is selected */
  onRecentSelect: (query: string) => void;
}

/** Category display order for grouped results */
const CATEGORY_ORDER = ['scene', 'widget', 'setting', 'action'] as const;

/** Human-readable labels for each category */
const CATEGORY_LABELS: Record<string, string> = {
  scene: 'Scenes',
  widget: 'Widgets',
  setting: 'Settings',
  action: 'Actions',
};

/**
 * Groups results by category, maintaining the defined category order.
 */
function groupByCategory(
  results: CommandPaletteProps['results'],
): Array<{ category: string; label: string; items: CommandPaletteProps['results'] }> {
  const grouped = new Map<string, CommandPaletteProps['results']>();

  for (const result of results) {
    const cat = result.item.category;
    if (!grouped.has(cat)) {
      grouped.set(cat, []);
    }
    grouped.get(cat)!.push(result);
  }

  const sections: Array<{ category: string; label: string; items: CommandPaletteProps['results'] }> = [];

  for (const cat of CATEGORY_ORDER) {
    const items = grouped.get(cat);
    if (items && items.length > 0) {
      sections.push({
        category: cat,
        label: CATEGORY_LABELS[cat] || cat,
        items,
      });
    }
  }

  // Include any categories not in the predefined order
  for (const [cat, items] of grouped) {
    if (!CATEGORY_ORDER.includes(cat as (typeof CATEGORY_ORDER)[number])) {
      sections.push({
        category: cat,
        label: CATEGORY_LABELS[cat] || cat,
        items,
      });
    }
  }

  return sections;
}

export function CommandPalette({
  open,
  onClose,
  onSelect,
  query,
  onQueryChange,
  results,
  recentSearches,
  onRecentSelect,
}: CommandPaletteProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<Element | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Compute flat list of selectable item IDs for keyboard navigation
  const flatItems = query.trim() === '' ? [] : results;
  const totalItems = query.trim() === '' ? recentSearches.length : flatItems.length;

  // Reset selection when results or query change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, results]);

  // Store trigger element and restore focus on close
  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement;
    } else if (triggerRef.current && triggerRef.current instanceof HTMLElement) {
      triggerRef.current.focus();
      triggerRef.current = null;
    }
  }, [open]);

  // Auto-focus input when opened
  useEffect(() => {
    if (open && inputRef.current) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [open]);

  // Focus trap within the palette
  useEffect(() => {
    if (!open || !panelRef.current) return;
    const cleanup = trapFocus(panelRef.current);
    return cleanup;
  }, [open]);

  // Keyboard navigation handler
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      switch (event.key) {
        case 'Escape':
          event.preventDefault();
          event.stopPropagation();
          onClose();
          break;

        case 'ArrowDown':
          event.preventDefault();
          setSelectedIndex((prev) => (totalItems > 0 ? (prev + 1) % totalItems : 0));
          break;

        case 'ArrowUp':
          event.preventDefault();
          setSelectedIndex((prev) =>
            totalItems > 0 ? (prev - 1 + totalItems) % totalItems : 0,
          );
          break;

        case 'Enter':
          event.preventDefault();
          if (query.trim() === '') {
            // Select from recent searches
            if (recentSearches.length > 0 && selectedIndex < recentSearches.length) {
              onRecentSelect(recentSearches[selectedIndex]);
            }
          } else {
            // Select from results
            if (flatItems.length > 0 && selectedIndex < flatItems.length) {
              onSelect(flatItems[selectedIndex].item.id);
            }
          }
          break;
      }
    },
    [onClose, onSelect, onRecentSelect, query, flatItems, recentSearches, selectedIndex, totalItems],
  );

  // Backdrop click handler
  const handleBackdropClick = useCallback(
    (event: React.MouseEvent) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  if (!open) return null;

  const showRecentSearches = query.trim() === '' && recentSearches.length > 0;
  const showResults = query.trim() !== '' && results.length > 0;
  const showEmpty = query.trim() !== '' && results.length === 0;
  const groupedResults = showResults ? groupByCategory(results) : [];

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onKeyDown={handleKeyDown}
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div
        className={cn(
          'absolute inset-0 bg-[var(--color-bg-overlay)]',
          'animate-backdrop-enter',
        )}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="combobox"
        aria-expanded="true"
        aria-haspopup="listbox"
        aria-label="Command palette"
        tabIndex={-1}
        className={cn(
          'relative z-10 w-full max-w-[560px]',
          'bg-[var(--color-bg-elevated)]',
          'border border-[var(--color-border-default)]',
          'rounded-[var(--radius-xl)]',
          'shadow-[var(--shadow-xl)]',
          'animate-modal-enter',
          'flex flex-col overflow-hidden',
          'focus:outline-none',
        )}
      >
        {/* Search input */}
        <div className="flex items-center gap-[var(--space-3)] px-[var(--space-4)] py-[var(--space-3)] border-b border-[var(--color-border-default)]">
          <Search
            size={18}
            className="shrink-0 text-[var(--color-text-muted)]"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search scenes, widgets, settings, actions..."
            className={cn(
              'flex-1 bg-transparent border-none outline-none',
              'text-[var(--text-sm)] text-[var(--color-text-primary)]',
              'placeholder:text-[var(--color-text-muted)]',
            )}
            aria-label="Search command palette"
            aria-autocomplete="list"
            aria-controls="command-palette-results"
          />
          <kbd
            className={cn(
              'hidden sm:inline-flex items-center',
              'px-[var(--space-2)] py-0.5',
              'text-[var(--text-xs)] text-[var(--color-text-muted)]',
              'bg-[var(--color-bg-surface)] rounded-[var(--radius-sm)]',
              'border border-[var(--color-border-default)]',
            )}
          >
            Esc
          </kbd>
        </div>

        {/* Results area */}
        <div
          id="command-palette-results"
          role="listbox"
          aria-label="Search results"
          className="max-h-[360px] overflow-y-auto p-[var(--space-2)]"
        >
          {/* Recent searches (shown when query is empty) */}
          {showRecentSearches && (
            <div>
              <div className="flex items-center gap-[var(--space-2)] px-[var(--space-3)] py-[var(--space-2)]">
                <Clock
                  size={14}
                  className="text-[var(--color-text-muted)]"
                  aria-hidden="true"
                />
                <span className="text-[var(--text-xs)] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                  Recent Searches
                </span>
              </div>
              {recentSearches.map((recentQuery, index) => (
                <div
                  key={recentQuery}
                  role="option"
                  aria-selected={selectedIndex === index}
                  onClick={() => onRecentSelect(recentQuery)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onRecentSelect(recentQuery);
                    }
                  }}
                  tabIndex={-1}
                  className={cn(
                    'flex items-center gap-[var(--space-3)] px-[var(--space-3)] py-[var(--space-2)]',
                    'rounded-[var(--radius-md)] cursor-pointer',
                    'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-default)]',
                    'hover:bg-[var(--color-bg-surface)]',
                    selectedIndex === index && 'bg-[var(--color-bg-surface)]',
                  )}
                >
                  <Search
                    size={14}
                    className="shrink-0 text-[var(--color-text-muted)]"
                    aria-hidden="true"
                  />
                  <span className="text-[var(--text-sm)] text-[var(--color-text-secondary)]">
                    {recentQuery}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Grouped search results */}
          {showResults && (
            <div>
              {groupedResults.map((section, sectionIndex) => {
                // Calculate the starting index for this section in the flat list
                let startIndex = 0;
                for (let i = 0; i < sectionIndex; i++) {
                  startIndex += groupedResults[i].items.length;
                }

                return (
                  <div key={section.category} className={cn(sectionIndex > 0 && 'mt-[var(--space-2)]')}>
                    {/* Section header */}
                    <div className="px-[var(--space-3)] py-[var(--space-2)]">
                      <span className="text-[var(--text-xs)] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                        {section.label}
                      </span>
                    </div>

                    {/* Section items */}
                    {section.items.map((result, itemIndex) => {
                      const flatIndex = startIndex + itemIndex;
                      return (
                        <SearchResult
                          key={result.item.id}
                          label={result.item.label}
                          category={result.item.category as 'scene' | 'widget' | 'setting' | 'action'}
                          matchIndices={result.matchIndices}
                          selected={selectedIndex === flatIndex}
                          path={result.item.path}
                          onClick={() => onSelect(result.item.id)}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty state */}
          {showEmpty && (
            <div className="flex flex-col items-center justify-center py-[var(--space-8)] text-center">
              <Search
                size={32}
                className="text-[var(--color-text-muted)] mb-[var(--space-3)]"
                aria-hidden="true"
              />
              <p className="text-[var(--text-sm)] text-[var(--color-text-muted)]">
                No results found for &ldquo;{query}&rdquo;
              </p>
              <p className="text-[var(--text-xs)] text-[var(--color-text-muted)] mt-[var(--space-1)]">
                Try a different search term
              </p>
            </div>
          )}

          {/* Empty state when no recent searches and no query */}
          {query.trim() === '' && recentSearches.length === 0 && (
            <div className="flex flex-col items-center justify-center py-[var(--space-8)] text-center">
              <Search
                size={32}
                className="text-[var(--color-text-muted)] mb-[var(--space-3)]"
                aria-hidden="true"
              />
              <p className="text-[var(--text-sm)] text-[var(--color-text-muted)]">
                Start typing to search
              </p>
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-[var(--space-4)] px-[var(--space-4)] py-[var(--space-2)] border-t border-[var(--color-border-default)]">
          <span className="flex items-center gap-[var(--space-1)] text-[var(--text-xs)] text-[var(--color-text-muted)]">
            <kbd className="px-1 py-0.5 bg-[var(--color-bg-surface)] rounded-[var(--radius-sm)] border border-[var(--color-border-default)] text-[10px]">↑↓</kbd>
            navigate
          </span>
          <span className="flex items-center gap-[var(--space-1)] text-[var(--text-xs)] text-[var(--color-text-muted)]">
            <kbd className="px-1 py-0.5 bg-[var(--color-bg-surface)] rounded-[var(--radius-sm)] border border-[var(--color-border-default)] text-[10px]">↵</kbd>
            select
          </span>
          <span className="flex items-center gap-[var(--space-1)] text-[var(--text-xs)] text-[var(--color-text-muted)]">
            <kbd className="px-1 py-0.5 bg-[var(--color-bg-surface)] rounded-[var(--radius-sm)] border border-[var(--color-border-default)] text-[10px]">esc</kbd>
            close
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
