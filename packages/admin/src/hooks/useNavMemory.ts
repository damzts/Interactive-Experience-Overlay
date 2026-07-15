import { useRef } from 'react'
import type { SelectedItem } from '../features/dashboard/types'

export interface NavMemory {
  /** Store the last-visited item for a section. No re-render is triggered. */
  remember(sectionId: string, item: SelectedItem): void
  /** Retrieve the last-visited item for a section, or null if none recorded. */
  recall(sectionId: string): SelectedItem | null
}

/**
 * Creates a plain NavMemory instance backed by a Map.
 * Exported for direct use in unit tests without a React renderer.
 */
export function createNavMemory(): NavMemory {
  const map = new Map<string, SelectedItem>()
  return {
    remember(sectionId, item) {
      map.set(sectionId, item)
    },
    recall(sectionId) {
      return map.get(sectionId) ?? null
    },
  }
}

/**
 * In-memory session navigation memory.
 *
 * Tracks the last `SelectedItem` the user visited in each TopBar section.
 * Uses a `useRef` internally so writes never cause re-renders.
 * The returned object is stable for the lifetime of the component.
 *
 * @example
 * ```ts
 * const navMemory = useNavMemory()
 * navMemory.remember('integrations', { kind: 'twitch' })
 * navMemory.recall('integrations') // → { kind: 'twitch' }
 * navMemory.recall('unknown')      // → null
 * ```
 */
export function useNavMemory(): NavMemory {
  const ref = useRef<NavMemory | null>(null)
  if (ref.current === null) {
    ref.current = createNavMemory()
  }
  return ref.current
}
