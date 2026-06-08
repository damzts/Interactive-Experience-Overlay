import type { CameraPermissionState } from '@ieomlabs/shared'

export interface ConnectionSlice {
  obsConnected: boolean
  cameraPermissionState: CameraPermissionState
  overlayOwnerSocketId: string | null
  reactiveIconId: string | null
  lastSocketActivityAt: number

  setObsConnected: (b: boolean) => void
  setCameraPermissionState: (state: CameraPermissionState) => void
  setOverlayOwnerSocketId: (socketId: string | null) => void
  setReactiveIconId: (id: string | null) => void
  markSocketActivity: () => void
}

export const createConnectionSlice = (set: (fn: (state: any) => Partial<any>) => void): ConnectionSlice => ({
  obsConnected: false,
  cameraPermissionState: 'unknown',
  overlayOwnerSocketId: null,
  reactiveIconId: null,
  lastSocketActivityAt: 0,

  setObsConnected: (b) => set(() => ({ obsConnected: b })),
  setCameraPermissionState: (s) => set(() => ({ cameraPermissionState: s })),
  setOverlayOwnerSocketId: (id) => set(() => ({ overlayOwnerSocketId: id })),
  setReactiveIconId: (id) => set(() => ({ reactiveIconId: id })),
  markSocketActivity: () => set(() => ({ lastSocketActivityAt: Date.now() })),
})
