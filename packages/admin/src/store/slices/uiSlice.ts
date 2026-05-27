import type { StateCreator } from 'zustand'

export type PreviewTarget = 'runtime' | 'dev'

const PREVIEW_TARGET_STORAGE_KEY = 'ieom.admin.previewTarget'

function getStoredPreviewTarget(): PreviewTarget {
  if (typeof window === 'undefined') return 'runtime'
  try {
    const saved = window.localStorage.getItem(PREVIEW_TARGET_STORAGE_KEY)
    return saved === 'dev' ? 'dev' : 'runtime'
  } catch {
    return 'runtime'
  }
}

function storePreviewTarget(target: PreviewTarget) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PREVIEW_TARGET_STORAGE_KEY, target)
  } catch {
    // Ignore storage failures; this is only a local UI preference.
  }
}

export interface UiSlice {
  previewTarget: PreviewTarget
  lastError: string | null

  setPreviewTarget: (target: PreviewTarget) => void
  setLastError: (e: string | null) => void
}

export const createUiSlice: StateCreator<UiSlice, [], [], UiSlice> = (set) => ({
  previewTarget: getStoredPreviewTarget(),
  lastError: null,

  setPreviewTarget: (target) => {
    storePreviewTarget(target)
    set({ previewTarget: target })
  },
  setLastError: (e) => set({ lastError: e }),
})
