import { create } from 'zustand'
import { STATE, DEFAULT_CONFIG, DEFAULT_DESKTOP_NOTIFICATION_MAX_VISIBLE, applyRuntimeConfigOverride, mergeAppConfig } from '@ieom/shared'
import type {
  AppConfig,
  CameraPermissionState,
  DesktopNotificationPayload,
  DesktopRuntimeStatePayload,
  RuntimeConfigOverridePayload,
  TransitionStep,
} from '@ieom/shared'

/** visualState never equals STATE.TRANSITIONING — CSS classes use this */
type VisualState = Exclude<STATE, typeof STATE.TRANSITIONING>

const WINDOW_CLOSE_MS = 180
const widgetCloseTimers = new Map<string, ReturnType<typeof setTimeout>>()

function clearWidgetCloseTimer(widgetId: string) {
  const timer = widgetCloseTimers.get(widgetId)
  if (timer) {
    clearTimeout(timer)
    widgetCloseTimers.delete(widgetId)
  }
}

function clearAllWidgetCloseTimers() {
  for (const timer of widgetCloseTimers.values()) clearTimeout(timer)
  widgetCloseTimers.clear()
}

export interface DesktopNotificationItem extends DesktopNotificationPayload {
  id: string
  createdAt: number
}

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
  persistedConfig: AppConfig
  runtimeConfigOverride: RuntimeConfigOverridePayload
  config: AppConfig
  previewBaseConfig: AppConfig | null
  previewConfigPatch: Partial<AppConfig> | null
  configLoaded: boolean
  obsConnected: boolean
  openWidgets: Set<string>
  minimizedWidgets: Set<string>
  closingWidgets: Set<string>
  desktopNotifications: DesktopNotificationItem[]
  recycleBinFull: boolean
  cameraPermissionState: CameraPermissionState
  cameraOwnerSocketId: string | null
  reactiveIconId: string | null
  lastSocketActivityAt: number

  setVisualState: (s: VisualState) => void
  setPendingVisualState: (s: VisualState) => void
  clearPendingVisualState: () => void
  setPendingTransition: (t: PendingTransition) => void
  clearPendingTransition: () => void
  setConfig: (c: AppConfig) => void
  patchConfig: (updates: Partial<AppConfig>) => void
  setRuntimeConfigOverride: (updates: RuntimeConfigOverridePayload) => void
  applyPreviewConfig: (updates: Partial<AppConfig>) => void
  clearPreviewConfig: () => void
  setObsConnected: (b: boolean) => void
  openWidget: (id: string) => void
  closeWidget: (id: string) => void
  toggleWidget: (id: string) => void
  minimizeWidget: (id: string) => void
  restoreWidget: (id: string) => void
  toggleWidgetMinimized: (id: string) => void
  enqueueDesktopNotification: (payload: DesktopNotificationPayload, maxVisible?: number) => void
  dismissDesktopNotification: (id: string) => void
  setRecycleBinFull: (full: boolean) => void
  setCameraPermissionState: (state: CameraPermissionState) => void
  setCameraOwnerSocketId: (socketId: string | null) => void
  setReactiveIconId: (id: string | null) => void
  markSocketActivity: () => void
  syncDesktopRuntimeState: (payload: DesktopRuntimeStatePayload) => void
}

export const useAppStore = create<AppStore>((set, get) => ({
  visualState: STATE.DESKTOP as VisualState,
  pendingVisualState: null,
  pendingTransition: null,
  persistedConfig: DEFAULT_CONFIG,
  runtimeConfigOverride: {},
  config: DEFAULT_CONFIG,
  previewBaseConfig: null,
  previewConfigPatch: null,
  configLoaded: false,
  obsConnected: false,
  openWidgets: new Set<string>(),
  minimizedWidgets: new Set<string>(),
  closingWidgets: new Set<string>(),
  desktopNotifications: [],
  recycleBinFull: false,
  cameraPermissionState: 'unknown',
  cameraOwnerSocketId: null,
  reactiveIconId: null,
  lastSocketActivityAt: 0,

  setVisualState: (s) => set({ visualState: s }),
  setPendingVisualState: (s) => set({ pendingVisualState: s }),
  clearPendingVisualState: () => set({ pendingVisualState: null }),
  setPendingTransition: (t) => set({ pendingTransition: t }),
  clearPendingTransition: () => set({ pendingTransition: null }),
  setConfig: (c) => set((state) => {
    const runtimeBaseConfig = applyRuntimeConfigOverride(c, state.runtimeConfigOverride)
    if (!state.previewConfigPatch) {
      return { persistedConfig: c, config: runtimeBaseConfig, configLoaded: true }
    }

    return {
      persistedConfig: c,
      config: mergeAppConfig(runtimeBaseConfig, state.previewConfigPatch),
      previewBaseConfig: runtimeBaseConfig,
      configLoaded: true,
    }
  }),
  patchConfig: (updates) => set((state) => {
    const persistedConfig = mergeAppConfig(state.persistedConfig, updates)
    const runtimeBaseConfig = applyRuntimeConfigOverride(persistedConfig, state.runtimeConfigOverride)
    if (!state.previewConfigPatch) {
      return { persistedConfig, config: runtimeBaseConfig, configLoaded: true }
    }

    return {
      persistedConfig,
      config: mergeAppConfig(runtimeBaseConfig, state.previewConfigPatch),
      previewBaseConfig: runtimeBaseConfig,
      configLoaded: true,
    }
  }),
  setRuntimeConfigOverride: (updates) => set((state) => {
    const runtimeBaseConfig = applyRuntimeConfigOverride(state.persistedConfig, updates)
    if (!state.previewConfigPatch) {
      return {
        runtimeConfigOverride: updates,
        config: runtimeBaseConfig,
        configLoaded: true,
      }
    }

    return {
      runtimeConfigOverride: updates,
      config: mergeAppConfig(runtimeBaseConfig, state.previewConfigPatch),
      previewBaseConfig: runtimeBaseConfig,
      configLoaded: true,
    }
  }),
  applyPreviewConfig: (updates) => set((state) => {
    const previewBaseConfig = applyRuntimeConfigOverride(state.persistedConfig, state.runtimeConfigOverride)
    return {
      previewBaseConfig,
      previewConfigPatch: updates,
      config: mergeAppConfig(previewBaseConfig, updates),
      configLoaded: true,
    }
  }),
  clearPreviewConfig: () => set((state) => {
    if (!state.previewBaseConfig) {
      return { previewConfigPatch: null }
    }

    return {
      config: applyRuntimeConfigOverride(state.persistedConfig, state.runtimeConfigOverride),
      previewBaseConfig: null,
      previewConfigPatch: null,
      configLoaded: true,
    }
  }),
  setObsConnected: (b) => set({ obsConnected: b }),
  openWidget: (id) => {
    clearWidgetCloseTimer(id)
    set((state) => {
      const openWidgets = new Set(state.openWidgets)
      const minimizedWidgets = new Set(state.minimizedWidgets)
      const closingWidgets = new Set(state.closingWidgets)
      openWidgets.add(id)
      minimizedWidgets.delete(id)
      closingWidgets.delete(id)
      return { openWidgets, minimizedWidgets, closingWidgets }
    })
  },
  closeWidget: (id) => {
    const state = get()
    if (state.openWidgets.has(id) && !state.closingWidgets.has(id)) {
      get().toggleWidget(id)
      return
    }
    clearWidgetCloseTimer(id)
    set((current) => {
      const openWidgets = new Set(current.openWidgets)
      const minimizedWidgets = new Set(current.minimizedWidgets)
      const closingWidgets = new Set(current.closingWidgets)
      openWidgets.delete(id)
      minimizedWidgets.delete(id)
      closingWidgets.delete(id)
      return { openWidgets, minimizedWidgets, closingWidgets }
    })
  },
  toggleWidget: (id) => {
    const state = get()
    if (state.openWidgets.has(id) && !state.closingWidgets.has(id)) {
      clearWidgetCloseTimer(id)
      set((current) => {
        const closingWidgets = new Set(current.closingWidgets)
        const minimizedWidgets = new Set(current.minimizedWidgets)
        closingWidgets.add(id)
        minimizedWidgets.delete(id)
        return { closingWidgets, minimizedWidgets }
      })
      const timer = setTimeout(() => {
        set((current) => {
          const openWidgets = new Set(current.openWidgets)
          const minimizedWidgets = new Set(current.minimizedWidgets)
          const closingWidgets = new Set(current.closingWidgets)
          openWidgets.delete(id)
          minimizedWidgets.delete(id)
          closingWidgets.delete(id)
          return { openWidgets, minimizedWidgets, closingWidgets }
        })
        widgetCloseTimers.delete(id)
      }, WINDOW_CLOSE_MS)
      widgetCloseTimers.set(id, timer)
      return
    }
    get().openWidget(id)
  },
  minimizeWidget: (id) => set((state) => {
    const minimizedWidgets = new Set(state.minimizedWidgets)
    minimizedWidgets.add(id)
    return { minimizedWidgets }
  }),
  restoreWidget: (id) => set((state) => {
    const minimizedWidgets = new Set(state.minimizedWidgets)
    minimizedWidgets.delete(id)
    return { minimizedWidgets }
  }),
  toggleWidgetMinimized: (id) => {
    const state = get()
    if (!state.openWidgets.has(id)) {
      get().openWidget(id)
      return
    }
    if (state.minimizedWidgets.has(id)) get().restoreWidget(id)
    else get().minimizeWidget(id)
  },
  enqueueDesktopNotification: (payload, maxVisible = DEFAULT_DESKTOP_NOTIFICATION_MAX_VISIBLE) => set((state) => {
    const next: DesktopNotificationItem = {
      ...payload,
      id: `desktop-note-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      createdAt: Date.now(),
    }
    return { desktopNotifications: [next, ...state.desktopNotifications].slice(0, maxVisible) }
  }),
  dismissDesktopNotification: (id) => set((state) => ({
    desktopNotifications: state.desktopNotifications.filter((item) => item.id !== id),
  })),
  setRecycleBinFull: (full) => set({ recycleBinFull: full }),
  setCameraPermissionState: (cameraPermissionState) => set({ cameraPermissionState }),
  setCameraOwnerSocketId: (cameraOwnerSocketId) => set({ cameraOwnerSocketId }),
  setReactiveIconId: (id) => set({ reactiveIconId: id }),
  markSocketActivity: () => set({ lastSocketActivityAt: Date.now() }),
  syncDesktopRuntimeState: (payload) => {
    clearAllWidgetCloseTimers()
    set({
      openWidgets: new Set(payload.openWidgetIds),
      minimizedWidgets: new Set<string>(),
      closingWidgets: new Set<string>(),
      recycleBinFull: payload.recycleBinFull,
    })
  },
}))
