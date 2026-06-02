import { STATE } from '@ieom/shared'
import type { TransitionStep } from '@ieom/shared'

type VisualState = Exclude<STATE, typeof STATE.TRANSITIONING>

export interface PendingTransition {
  from: STATE
  to: STATE
  exit: TransitionStep[]
  intro: TransitionStep[]
}

export interface SceneSlice {
  visualState: VisualState
  pendingVisualState: VisualState | null
  pendingTransition: PendingTransition | null

  setVisualState: (s: VisualState) => void
  setPendingVisualState: (s: VisualState) => void
  clearPendingVisualState: () => void
  setPendingTransition: (t: PendingTransition) => void
  clearPendingTransition: () => void
}

export const createSceneSlice = (set: (fn: (state: any) => Partial<any>) => void): SceneSlice => ({
  visualState: STATE.DESKTOP as VisualState,
  pendingVisualState: null,
  pendingTransition: null,

  setVisualState: (s) => set(() => ({ visualState: s })),
  setPendingVisualState: (s) => set(() => ({ pendingVisualState: s })),
  clearPendingVisualState: () => set(() => ({ pendingVisualState: null })),
  setPendingTransition: (t) => set(() => ({ pendingTransition: t })),
  clearPendingTransition: () => set(() => ({ pendingTransition: null })),
})
