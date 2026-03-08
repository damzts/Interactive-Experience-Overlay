import { create } from 'zustand'
import { STATE, DEFAULT_CONFIG } from '@ieom/shared'
import type { AppConfig, Application } from '@ieom/shared'

/** visualState never equals STATE.TRANSITIONING — CSS classes use this */
type VisualState = Exclude<STATE, typeof STATE.TRANSITIONING>

export interface PendingTransition {
  from: STATE
  to: STATE
  transitionType: string
}

interface AppStore {
  visualState: VisualState
  pendingTransition: PendingTransition | null
  config: AppConfig
  obsConnected: boolean

  setVisualState: (s: VisualState) => void
  setPendingTransition: (t: PendingTransition) => void
  clearPendingTransition: () => void
  setConfig: (c: AppConfig) => void
  setObsConnected: (b: boolean) => void
}

export const useAppStore = create<AppStore>((set) => ({
  visualState: STATE.DESKTOP as VisualState,
  pendingTransition: null,
  config: DEFAULT_CONFIG,
  obsConnected: false,

  setVisualState: (s) => set({ visualState: s }),
  setPendingTransition: (t) => set({ pendingTransition: t }),
  clearPendingTransition: () => set({ pendingTransition: null }),
  setConfig: (c) => set({ config: c }),
  setObsConnected: (b) => set({ obsConnected: b }),
}))
