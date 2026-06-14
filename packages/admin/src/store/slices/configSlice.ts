import type { StateCreator } from 'zustand'
import { DEFAULT_CONFIG, applyRuntimeConfig, mergeAppConfig } from '@ieomlabs/shared'
import type { AppConfig, RuntimeConfig } from '@ieomlabs/shared'
import { fetchConfig, patchConfig } from '../../api/configApi'

export interface ConfigSlice {
  persistedConfig: AppConfig
  runtimeConfig: RuntimeConfig
  config: AppConfig
  configLoaded: boolean

  setConfig: (c: AppConfig) => void
  patchConfig: (updates: Partial<AppConfig>) => void
  setRuntimeConfig: (updates: RuntimeConfig) => void
  fetchConfig: () => Promise<void>
  saveConfig: (updates: Partial<AppConfig>) => Promise<void>
}

export const createConfigSlice: StateCreator<ConfigSlice & UiSliceRef, [], [], ConfigSlice> = (set, get) => ({
  persistedConfig: DEFAULT_CONFIG,
  runtimeConfig: {},
  config: DEFAULT_CONFIG,
  configLoaded: false,

  setConfig: (c) =>
    set((state) => ({
      persistedConfig: c,
      config: applyRuntimeConfig(c, state.runtimeConfig),
      configLoaded: true,
    })),

  patchConfig: (updates) =>
    set((state) => {
      const persistedConfig = mergeAppConfig(state.persistedConfig, updates)
      return {
        persistedConfig,
        config: applyRuntimeConfig(persistedConfig, state.runtimeConfig),
        configLoaded: true,
      }
    }),

  setRuntimeConfig: (updates) =>
    set((state) => ({
      runtimeConfig: updates,
      config: applyRuntimeConfig(state.persistedConfig, updates),
      configLoaded: true,
    })),

  fetchConfig: async () => {
    try {
      const data = await fetchConfig()
      set((state) => ({
        persistedConfig: data,
        config: applyRuntimeConfig(data, state.runtimeConfig),
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
        config: applyRuntimeConfig(merged, state.runtimeConfig),
      }))
    } catch (e) {
      get().setLastError(String(e))
      throw e
    }
  },
})

interface UiSliceRef {
  setLastError: (e: string | null) => void
}
