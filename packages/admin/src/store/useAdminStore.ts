import { create } from 'zustand'
import { createConfigSlice, type ConfigSlice } from './slices/configSlice'
import { createRuntimeSlice, type RuntimeSlice } from './slices/runtimeSlice'
import { createUiSlice, type UiSlice } from './slices/uiSlice'

export type { PreviewTarget } from './slices/uiSlice'

export type AdminStore = ConfigSlice & RuntimeSlice & UiSlice

export const useAdminStore = create<AdminStore>((...args) => ({
  ...createConfigSlice(...args),
  ...createRuntimeSlice(...args),
  ...createUiSlice(...args),
}))
