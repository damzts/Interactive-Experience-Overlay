import type { StateCreator } from 'zustand'

export interface UiSlice {
  lastError: string | null

  setLastError: (e: string | null) => void
}

export const createUiSlice: StateCreator<UiSlice, [], [], UiSlice> = (set) => ({
  lastError: null,

  setLastError: (e) => set({ lastError: e }),
})
