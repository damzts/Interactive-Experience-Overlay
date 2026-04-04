import { create } from 'zustand'
import { STATE, DEFAULT_CONFIG, mergeAppConfig } from '@ieom/shared'
import type { AppConfig, DesktopRuntimeStatePayload } from '@ieom/shared'

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

function findSingleChangedApplication(
  currentApplications: AppConfig['applications'],
  nextApplications: AppConfig['applications'],
) {
  if (currentApplications.length !== nextApplications.length) return null

  let changedIndex = -1

  for (let index = 0; index < currentApplications.length; index += 1) {
    const currentApp = currentApplications[index]
    const nextApp = nextApplications[index]
    if (currentApp.id !== nextApp.id) return null
    if (JSON.stringify(currentApp) === JSON.stringify(nextApp)) continue
    if (changedIndex !== -1) return null
    changedIndex = index
  }

  return changedIndex === -1 ? null : nextApplications[changedIndex]
}

interface AdminStore {
  currentState: STATE
  obsConnected: boolean
  clientCount: number
  lastError: string | null
  config: AppConfig
  configLoaded: boolean
  previewTarget: PreviewTarget
  openWidgetIds: string[]
  recycleBinFull: boolean
  simulationLeaderId: string | null
  ambianceAcceptedCount: number
  ambianceRejectedCount: number

  setCurrentState: (s: STATE) => void
  setObsConnected: (b: boolean) => void
  setClientCount: (n: number) => void
  setLastError: (e: string | null) => void
  setConfig: (c: AppConfig) => void
  patchConfig: (updates: Partial<AppConfig>) => void
  setPreviewTarget: (target: PreviewTarget) => void
  syncDesktopRuntimeState: (payload: DesktopRuntimeStatePayload) => void
  toggleWidgetRuntimeState: (widgetId: string) => void
  setRecycleBinFull: (full: boolean) => void
  setSimulationLeaderId: (id: string | null) => void
  setAmbianceMetrics: (payload: { accepted: number; rejected: number }) => void
  fetchConfig: () => Promise<void>
  saveConfig: (updates: Partial<AppConfig>) => Promise<void>
}

export const useAdminStore = create<AdminStore>((set, get) => ({
  currentState: STATE.DESKTOP,
  obsConnected: false,
  clientCount: 0,
  lastError: null,
  config: DEFAULT_CONFIG,
  configLoaded: false,
  previewTarget: getStoredPreviewTarget(),
  openWidgetIds: [],
  recycleBinFull: false,
  simulationLeaderId: null,
  ambianceAcceptedCount: 0,
  ambianceRejectedCount: 0,

  setCurrentState: (s) => set({ currentState: s }),
  setObsConnected: (b) => set({ obsConnected: b }),
  setClientCount: (n) => set({ clientCount: n }),
  setLastError: (e) => set({ lastError: e }),
  setConfig: (c) => set({ config: c, configLoaded: true }),
  patchConfig: (updates) => set((state) => ({ config: mergeAppConfig(state.config, updates), configLoaded: true })),
  setPreviewTarget: (target) => {
    storePreviewTarget(target)
    set({ previewTarget: target })
  },
  syncDesktopRuntimeState: (payload) => set({
    openWidgetIds: payload.openWidgetIds,
    recycleBinFull: payload.recycleBinFull,
  }),
  toggleWidgetRuntimeState: (widgetId) => set((state) => ({
    openWidgetIds: state.openWidgetIds.includes(widgetId)
      ? state.openWidgetIds.filter((id) => id !== widgetId)
      : [...state.openWidgetIds, widgetId],
  })),
  setRecycleBinFull: (full) => set({ recycleBinFull: full }),
  setSimulationLeaderId: (id) => set({ simulationLeaderId: id }),
  setAmbianceMetrics: (payload) => set({ ambianceAcceptedCount: payload.accepted, ambianceRejectedCount: payload.rejected }),

  fetchConfig: async () => {
    try {
      const res = await fetch('/api/config')
      if (res.ok) {
        const data: AppConfig = await res.json()
        set({ config: data, configLoaded: true })
      }
    } catch (e) {
      console.error('[admin] fetchConfig failed', e)
    }
  },

  saveConfig: async (updates: Partial<AppConfig>) => {
    const merged = mergeAppConfig(get().config, updates)
    try {
      const keys = Object.keys(updates)
      let res: Response

      if (keys.length === 1 && updates.applications) {
        const changedApp = findSingleChangedApplication(get().config.applications, updates.applications)
        if (changedApp) {
          res = await fetch(`/api/config/applications/${encodeURIComponent(changedApp.id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(changedApp),
          })
        } else {
          res = await fetch('/api/config', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
          })
        }
      } else {
        res = await fetch('/api/config', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        })
      }

      if (res.ok) {
        set({ config: merged })
      } else {
        set({ lastError: `Save failed: ${res.status}` })
      }
    } catch (e) {
      set({ lastError: String(e) })
    }
  },
}))
