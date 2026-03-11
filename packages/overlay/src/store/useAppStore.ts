import { create } from 'zustand'
import { STATE, DEFAULT_CONFIG } from '@ieom/shared'
import type { AppConfig, Application, TransitionStep } from '@ieom/shared'

/** visualState never equals STATE.TRANSITIONING — CSS classes use this */
type VisualState = Exclude<STATE, typeof STATE.TRANSITIONING>

export interface PendingTransition {
  from: STATE
  to: STATE
  /** Steps played before the scene content swaps. */
  exit: TransitionStep[]
  /** Steps played after the scene content swaps. */
  intro: TransitionStep[]
}

interface AppStore {
  visualState: VisualState
  /** State buffered from state:update — applied at the midpoint of the transition */
  pendingVisualState: VisualState | null
  pendingTransition: PendingTransition | null
  config: AppConfig
  configLoaded: boolean
  obsConnected: boolean
  openWidgets: Set<string>

  setVisualState: (s: VisualState) => void
  setPendingVisualState: (s: VisualState) => void
  clearPendingVisualState: () => void
  setPendingTransition: (t: PendingTransition) => void
  clearPendingTransition: () => void
  setConfig: (c: AppConfig) => void
  setObsConnected: (b: boolean) => void
  toggleWidget: (id: string) => void
}

export const useAppStore = create<AppStore>((set) => ({
  visualState: STATE.DESKTOP as VisualState,
  pendingVisualState: null,
  pendingTransition: null,
  config: DEFAULT_CONFIG,
  configLoaded: false,
  obsConnected: false,
  openWidgets: new Set<string>(),

  setVisualState: (s) => set({ visualState: s }),
  setPendingVisualState: (s) => set({ pendingVisualState: s }),
  clearPendingVisualState: () => set({ pendingVisualState: null }),
  setPendingTransition: (t) => set({ pendingTransition: t }),
  clearPendingTransition: () => set({ pendingTransition: null }),
  setConfig: (c) => set({ config: c, configLoaded: true }),
  setObsConnected: (b) => set({ obsConnected: b }),
  toggleWidget: (id) => set((state) => {
    const next = new Set(state.openWidgets)
    if (next.has(id)) next.delete(id); else next.add(id)
    return { openWidgets: next }
  }),
}))
