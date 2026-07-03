/**
 * Search hook that builds a search index from sidebar navigation sections
 * and provides fuzzy search capabilities for the Command Palette.
 *
 * Accepts `SidebarSection[]` as input, builds `SearchIndexItem[]` from
 * the section hierarchy, and exposes a `performSearch` function that
 * returns ranked results using the fuzzy scoring algorithm from
 * `utils/searchIndex`.
 *
 * @example
 * ```tsx
 * const { query, results, recentSearches, performSearch, addRecentSearch } = useSearch(sections);
 *
 * performSearch('lobby');
 * // results → [{ item: { id: 'scenes-lobby', label: 'Lobby', category: 'scene' }, score: 100, ... }]
 * ```
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import type { SearchIndexItem, SearchResult } from '../utils/searchIndex';
import { search } from '../utils/searchIndex';

/** Navigation section shape accepted by the search index builder. */
export interface NavSection {
  id: string;
  label: string;
  children?: { id: string; label: string }[];
}

const MAX_RECENT_SEARCHES = 5;

/** Category mapping based on parent section id */
const SECTION_CATEGORY_MAP: Record<string, SearchIndexItem['category']> = {
  scenes: 'scene',
  widgets: 'widget',
  system: 'setting',
  settings: 'setting',
  media: 'setting',
  online: 'setting',
  dashboard: 'action',
};

/**
 * Builds a search index from sidebar navigation sections and provides
 * fuzzy search with recent search tracking.
 *
 * @param sections - The sidebar navigation sections to index
 * @returns Search state and actions: query, results, recentSearches, performSearch, addRecentSearch
 */
export function useSearch(sections: NavSection[]) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  /** Build index items from sections whenever they change */
  const indexItems = useMemo<SearchIndexItem[]>(() => {
    const items: SearchIndexItem[] = [];

    for (const section of sections) {
      // Add the top-level section as a searchable item
      items.push({
        id: section.id,
        label: section.label,
        category: 'setting',
        path: `/${section.id}`,
      });

      // Add children with category based on parent section
      if (section.children) {
        const childCategory = SECTION_CATEGORY_MAP[section.id] ?? 'setting';

        for (const child of section.children) {
          items.push({
            id: `${section.id}-${child.id}`,
            label: child.label,
            category: childCategory,
            path: `/${section.id}/${child.id}`,
          });
        }
      }
    }

    return items;
  }, [sections]);

  /** Reset results when index changes and there's an active query */
  useEffect(() => {
    if (query.trim()) {
      const newResults = search(query, indexItems);
      setResults(newResults);
    }
  }, [indexItems]);

  /** Execute a search against the index and update state */
  const performSearch = useCallback(
    (searchQuery: string) => {
      setQuery(searchQuery);
      const newResults = search(searchQuery, indexItems);
      setResults(newResults);
    },
    [indexItems],
  );

  /** Add a query to recent searches (max 5, no duplicates) */
  const addRecentSearch = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) return;
    setRecentSearches((prev) => {
      const filtered = prev.filter((s) => s !== searchQuery);
      return [searchQuery, ...filtered].slice(0, MAX_RECENT_SEARCHES);
    });
  }, []);

  return {
    query,
    results,
    recentSearches,
    performSearch,
    addRecentSearch,
  };
}
