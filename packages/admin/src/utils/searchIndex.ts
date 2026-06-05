/**
 * Fuzzy search index and scoring algorithm for the Command Palette.
 *
 * Indexes sidebar navigation items, widget/application names, scene names,
 * setting labels, and action names. Provides ranked results using a
 * multi-tier scoring system:
 *
 * - Exact prefix match: 100
 * - Word boundary match: 80
 * - Substring match: 60
 * - Fuzzy (character sequence): 40
 *
 * All comparisons are case-insensitive.
 */

/** A single item in the search index. */
export interface SearchIndexItem {
  /** Unique identifier for the item */
  id: string;
  /** Display label used for matching */
  label: string;
  /** Category grouping for result display */
  category: 'scene' | 'widget' | 'setting' | 'action';
  /** Optional navigation path associated with the item */
  path?: string;
}

/** A search result with its score and match positions. */
export interface SearchResult {
  /** The matched item */
  item: SearchIndexItem;
  /** Match score (100 = prefix, 80 = word boundary, 60 = substring, 40 = fuzzy) */
  score: number;
  /** Character positions in the target label that matched the query */
  matchIndices: number[];
}

/**
 * Stores items for searching. Returns the provided array for use with `search()`.
 *
 * @param items - Array of items to index
 * @returns The same array, ready for use with the search function
 *
 * @example
 * const index = buildSearchIndex([
 *   { id: 'scene-lobby', label: 'Lobby', category: 'scene', path: '/scenes/lobby' }
 * ]);
 */
export function buildSearchIndex(items: SearchIndexItem[]): SearchIndexItem[] {
  return items;
}

/**
 * Performs fuzzy search with scoring across all indexed items.
 *
 * Results are sorted by score descending. Ties are broken alphabetically by label.
 *
 * @param query - The search query string
 * @param items - The search index (from `buildSearchIndex`)
 * @param maxResults - Maximum number of results to return (default: 20)
 * @returns Sorted array of search results with scores and match indices
 *
 * @example
 * const results = search('lob', index);
 * // [{ item: { id: 'scene-lobby', label: 'Lobby', ... }, score: 100, matchIndices: [0, 1, 2] }]
 */
export function search(
  query: string,
  items: SearchIndexItem[],
  maxResults: number = 20
): SearchResult[] {
  if (!query.trim()) {
    return [];
  }

  const results: SearchResult[] = [];

  for (const item of items) {
    const match = scoreMatch(query, item.label);
    if (match) {
      results.push({
        item,
        score: match.score,
        matchIndices: match.matchIndices,
      });
    }
  }

  results.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.item.label.localeCompare(b.item.label);
  });

  return results.slice(0, maxResults);
}

/**
 * Core scoring algorithm that determines how well a query matches a target string.
 *
 * Scoring tiers (checked in order, first match wins):
 * 1. Exact prefix match (score 100) — query matches the start of target
 * 2. Word boundary match (score 80) — query matches at the start of a word in target
 * 3. Substring match (score 60) — query appears anywhere in target
 * 4. Fuzzy match (score 40) — all characters of query appear in order in target
 *
 * @param query - The search query
 * @param target - The target string to match against
 * @returns Score and match indices, or null if no match at all
 *
 * @example
 * scoreMatch('sc', 'Scene Config');
 * // { score: 100, matchIndices: [0, 1] }
 *
 * scoreMatch('con', 'Scene Config');
 * // { score: 80, matchIndices: [6, 7, 8] }
 *
 * scoreMatch('fig', 'Scene Config');
 * // { score: 60, matchIndices: [9, 10, 11] }
 *
 * scoreMatch('scg', 'Scene Config');
 * // { score: 40, matchIndices: [0, 1, 9] }
 */
export function scoreMatch(
  query: string,
  target: string
): { score: number; matchIndices: number[] } | null {
  if (!query || !target) {
    return null;
  }

  const lowerQuery = query.toLowerCase();
  const lowerTarget = target.toLowerCase();

  // 1. Exact prefix match (score 100)
  if (lowerTarget.startsWith(lowerQuery)) {
    const matchIndices = Array.from({ length: lowerQuery.length }, (_, i) => i);
    return { score: 100, matchIndices };
  }

  // 2. Word boundary match (score 80)
  const wordBoundaryIndices = findWordBoundaryMatch(lowerQuery, lowerTarget);
  if (wordBoundaryIndices) {
    return { score: 80, matchIndices: wordBoundaryIndices };
  }

  // 3. Substring match (score 60)
  const substringIndex = lowerTarget.indexOf(lowerQuery);
  if (substringIndex !== -1) {
    const matchIndices = Array.from(
      { length: lowerQuery.length },
      (_, i) => substringIndex + i
    );
    return { score: 60, matchIndices };
  }

  // 4. Fuzzy match (score 40)
  const fuzzyIndices = findFuzzyMatch(lowerQuery, lowerTarget);
  if (fuzzyIndices) {
    return { score: 40, matchIndices: fuzzyIndices };
  }

  return null;
}

/**
 * Finds a word boundary match — the query matches at the start of a word
 * within the target string (not the first word, which is handled by prefix).
 */
function findWordBoundaryMatch(
  lowerQuery: string,
  lowerTarget: string
): number[] | null {
  // Find positions where words start (after space, hyphen, underscore, or camelCase boundary)
  for (let i = 1; i < lowerTarget.length; i++) {
    if (isWordBoundary(lowerTarget, i)) {
      const remaining = lowerTarget.slice(i);
      if (remaining.startsWith(lowerQuery)) {
        return Array.from({ length: lowerQuery.length }, (_, j) => i + j);
      }
    }
  }
  return null;
}

/**
 * Checks if position `i` in the string is the start of a new word.
 * A word boundary occurs after a space, hyphen, underscore, colon,
 * or at a lowercase-to-uppercase transition (camelCase).
 */
function isWordBoundary(str: string, i: number): boolean {
  if (i === 0) return true;
  const prev = str[i - 1];
  return prev === ' ' || prev === '-' || prev === '_' || prev === ':';
}

/**
 * Finds a fuzzy match where all characters of the query appear in order
 * within the target. Returns the indices of matched characters, or null
 * if not all characters can be found in sequence.
 */
function findFuzzyMatch(
  lowerQuery: string,
  lowerTarget: string
): number[] | null {
  const indices: number[] = [];
  let targetIdx = 0;

  for (let queryIdx = 0; queryIdx < lowerQuery.length; queryIdx++) {
    const char = lowerQuery[queryIdx];
    let found = false;

    while (targetIdx < lowerTarget.length) {
      if (lowerTarget[targetIdx] === char) {
        indices.push(targetIdx);
        targetIdx++;
        found = true;
        break;
      }
      targetIdx++;
    }

    if (!found) {
      return null;
    }
  }

  return indices;
}
