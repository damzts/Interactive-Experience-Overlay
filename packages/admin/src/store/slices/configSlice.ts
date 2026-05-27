import type { StateCreator } from 'zustand'
import { DEFAULT_CONFIG, applyRuntimeConfigOverride, mergeAppConfig } from '@ieom/shared'
import type { AppConfig, RuntimeConfigOverridePayload } from '@ieom/shared'
import { fetchConfig, patchConfig } from '../../api/configApi'

export interface ConfigSlice {
  persistedConfig: AppConfig
  runtimeConfigOverride: RuntimeConfigOverridePayload
  config: AppConfig
  configLoaded: boolean

  setConfig: (c: AppConfig) => void
  patchConfig: (updates: Partial<AppConfig>) => void
  setRuntimeConfigOverride: (updates: RuntimeConfigOverridePayload) => void
  fetchConfig: () => Promise<void>
  saveConfig: (updates: Partial<AppConfig>) => Promise<void>
}

export const createConfigSlice: StateCreator<ConfigSlice & UiSliceRef, [], [], ConfigSlice> = (set, get) => ({
  persistedConfig: DEFAULT_CONFIG,
  runtimeConfigOverride: {},
  config: DEFAULT_CONFIG,
  configLoaded: false,

  setConfig: (c) =>
    set((state) => ({
      persistedConfig: c,
      config: applyRuntimeConfigOverride(c, state.runtimeConfigOverride),
      configLoaded: true,
    })),

  patchConfig: (updates) =>
    set((state) => {
      const persistedConfig = mergeAppConfig(state.persistedConfig, updates)
      return {
        persistedConfig,
        config: applyRuntimeConfigOverride(persistedConfig, state.runtimeConfigOverride),
        configLoaded: true,
      }
    }),

  setRuntimeConfigOverride: (updates) =>
    set((state) => ({
      runtimeConfigOverride: updates,
      config: applyRuntimeConfigOverride(state.persistedConfig, updates),
      configLoaded: true,
    })),

  fetchConfig: async () => {
    try {
      const data = await fetchConfig()
      set((state) => ({
        persistedConfig: data,
        config: applyRuntimeConfigOverride(data, state.runtimeConfigOverride),
        configLoaded: true,
      }))
    } catch (e) {
      console.error('[admin] fetchConfig failed', e)
    }
  },

  saveConfig: async (updates) => {
    try {
      const merged = await patchConfig(get().persistedConfig, updates)
      set((state) => ({
        persistedConfig: merged,
        config: applyRuntimeConfigOverride(merged, state.runtimeConfigOverride),
      }))
    } catch (e) {
      get().setLastError(String(e))
    }
  },
})

// Minimal cross-slice ref for error reporting
interface UiSliceRef {
  setLastError: (e: string | null) => void
}
