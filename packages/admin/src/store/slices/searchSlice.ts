/**
 * Search slice for the admin store.
 *
 * Manages the search index, query state, and filtered results used by
 * the Command Palette and global search features. Uses the fuzzy search
 * scoring algorithm from `utils/searchIndex` to rank results.
 */
import type { StateCreator } from 'zustand';
import type { SearchIndexItem, SearchResult } from '../../utils/searchIndex';
import { search } from '../../utils/searchIndex';

export interface SearchSlice {
  /** Current search query string */
  query: string;
  /** Ranked search results for the current query */
  results: SearchResult[];
  /** Recently executed searches (max 5, no duplicates) */
  recentSearches: string[];
  /** All indexed items available for searching */
  indexItems: SearchIndexItem[];

  /** Update the current query string */
  setQuery: (query: string) => void;
  /** Execute a search against the index and store results */
  performSearch: (query: string) => void;
  /** Add a query to recent searches (max 5, no duplicates) */
  addRecentSearch: (query: string) => void;
  /** Replace the full set of indexed items */
  setIndexItems: (items: SearchIndexItem[]) => void;
}

const MAX_RECENT_SEARCHES = 5;

export const createSearchSlice: StateCreator<SearchSlice, [], [], SearchSlice> = (set, get) => ({
  query: '',
  results: [],
  recentSearches: [],
  indexItems: [],

  setQuery: (query) => set({ query }),

  performSearch: (query) => {
    const { indexItems } = get();
    const results = search(query, indexItems);
    set({ query, results });
  },

  addRecentSearch: (query) => {
    if (!query.trim()) return;
    set((state) => {
      const filtered = state.recentSearches.filter((s) => s !== query);
      return {
        recentSearches: [query, ...filtered].slice(0, MAX_RECENT_SEARCHES),
      };
    });
  },

  setIndexItems: (items) => set({ indexItems: items }),
});
