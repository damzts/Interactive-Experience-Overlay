import { applyRuntimeConfig, mergeAppConfig } from '@ieomlabs/shared'
import type { AppConfig, RuntimeConfig } from '@ieomlabs/shared'

/** Minimal stub used before server config is received. Replaced immediately on socket connect. */
const EMPTY_CONFIG: AppConfig = {
  windowPresets: [], scenes: {}, applications: [], keybinds: { obs: {}, admin: {} },
  obs: { url: '', password: '' }, audio: { masterVolume: 0.8, sfxVolume: 0.7, musicVolume: 0.4 },
  desktopConfig: {} as any, desktopAmbiance: {} as any,
  widgetLayouts: [], sourceEvents: [], sourceMedia: [], sourceTransitions: [],
} as unknown as AppConfig

export interface ConfigSlice {
  persistedConfig: AppConfig
  runtimeConfig: RuntimeConfig
  config: AppConfig
  previewBaseConfig: AppConfig | null
  previewConfigPatch: Partial<AppConfig> | null
  configLoaded: boolean

  setConfig: (c: AppConfig) => void
  patchConfig: (updates: Partial<AppConfig>) => void
  setRuntimeConfig: (updates: RuntimeConfig) => void
  applyPreviewConfig: (updates: Partial<AppConfig>) => void
  clearPreviewConfig: () => void
}

export const createConfigSlice = (set: (fn: (state: any) => Partial<any>) => void, get: () => any): ConfigSlice => ({
  persistedConfig: EMPTY_CONFIG,
  runtimeConfig: {},
  config: EMPTY_CONFIG,
  previewBaseConfig: null,
  previewConfigPatch: null,
  configLoaded: false,

  setConfig: (c) => set((state) => {
    const runtimeBase = applyRuntimeConfig(c, state.runtimeConfig)
    if (!state.previewConfigPatch) return { persistedConfig: c, config: runtimeBase, configLoaded: true }
    return { persistedConfig: c, config: mergeAppConfig(runtimeBase, state.previewConfigPatch), previewBaseConfig: runtimeBase, configLoaded: true }
  }),

  patchConfig: (updates) => set((state) => {
    const persisted = mergeAppConfig(state.persistedConfig, updates)
    const runtimeBase = applyRuntimeConfig(persisted, state.runtimeConfig)
    if (!state.previewConfigPatch) return { persistedConfig: persisted, config: runtimeBase, configLoaded: true }
    return { persistedConfig: persisted, config: mergeAppConfig(runtimeBase, state.previewConfigPatch), previewBaseConfig: runtimeBase, configLoaded: true }
  }),

  setRuntimeConfig: (updates) => set((state) => {
    const runtimeBase = applyRuntimeConfig(state.persistedConfig, updates)
    if (!state.previewConfigPatch) return { runtimeConfig: updates, config: runtimeBase, configLoaded: true }
    return { runtimeConfig: updates, config: mergeAppConfig(runtimeBase, state.previewConfigPatch), previewBaseConfig: runtimeBase, configLoaded: true }
  }),

  applyPreviewConfig: (updates) => set((state) => {
    const previewBase = applyRuntimeConfig(state.persistedConfig, state.runtimeConfig)
    return { previewBaseConfig: previewBase, previewConfigPatch: updates, config: mergeAppConfig(previewBase, updates), configLoaded: true }
  }),

  clearPreviewConfig: () => set((state) => {
    if (!state.previewBaseConfig) return { previewConfigPatch: null }
    return {
      config: applyRuntimeConfig(state.persistedConfig, state.runtimeConfig),
      previewBaseConfig: null,
      previewConfigPatch: null,
      configLoaded: true,
    }
  }),
})
