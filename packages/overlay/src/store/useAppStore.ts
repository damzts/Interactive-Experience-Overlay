import { create } from 'zustand'
import { createSceneSlice, type SceneSlice, type PendingTransition } from './sceneSlice.js'
import { createConfigSlice, type ConfigSlice } from './configSlice.js'
import { createDesktopSlice, type DesktopSlice, type DesktopNotificationItem } from './desktopSlice.js'
import { createConnectionSlice, type ConnectionSlice } from './connectionSlice.js'

export type AppStore = SceneSlice & ConfigSlice & DesktopSlice & ConnectionSlice

export const useAppStore = create<AppStore>((set, get) => ({
  ...createSceneSlice(set),
  ...createConfigSlice(set, get),
  ...createDesktopSlice(set, get),
  ...createConnectionSlice(set),
}))

// Re-export types that consumers depend on
export type { PendingTransition, DesktopNotificationItem }
