import { applyRuntimeConfigOverride, mergeAppConfig } from '@ieomlabs/shared'
import type { AppConfig, RuntimeConfigOverridePayload } from '@ieomlabs/shared'

/** Minimal stub used before server config is received. Replaced immediately on socket connect. */
const EMPTY_CONFIG: AppConfig = {
  windowPresets: [], scenes: {}, applications: [], keybinds: { obs: {}, admin: {} },
  obs: { url: '', password: '' }, audio: { masterVolume: 0.8, sfxVolume: 0.7, musicVolume: 0.4 },
  desktopConfig: {} as any, desktopAmbiance: {} as any,
  widgetLayouts: [], sourceEvents: [], sourceMedia: [], sourceTransitions: [],
} as unknown as AppConfig

export interface ConfigSlice {
  persistedConfig: AppConfig
  runtimeConfigOverride: RuntimeConfigOverridePayload
  config: AppConfig
  previewBaseConfig: AppConfig | null
  previewConfigPatch: Partial<AppConfig> | null
  configLoaded: boolean

  setConfig: (c: AppConfig) => void
  patchConfig: (updates: Partial<AppConfig>) => void
  setRuntimeConfigOverride: (updates: RuntimeConfigOverridePayload) => void
  applyPreviewConfig: (updates: Partial<AppConfig>) => void
  clearPreviewConfig: () => void
}

export const createConfigSlice = (set: (fn: (state: any) => Partial<any>) => void, get: () => any): ConfigSlice => ({
  persistedConfig: EMPTY_CONFIG,
  runtimeConfigOverride: {},
  config: EMPTY_CONFIG,
  previewBaseConfig: null,
  previewConfigPatch: null,
  configLoaded: false,

  setConfig: (c) => set((state) => {
    const runtimeBase = applyRuntimeConfigOverride(c, state.runtimeConfigOverride)
    if (!state.previewConfigPatch) return { persistedConfig: c, config: runtimeBase, configLoaded: true }
    return { persistedConfig: c, config: mergeAppConfig(runtimeBase, state.previewConfigPatch), previewBaseConfig: runtimeBase, configLoaded: true }
  }),

  patchConfig: (updates) => set((state) => {
    const persisted = mergeAppConfig(state.persistedConfig, updates)
    const runtimeBase = applyRuntimeConfigOverride(persisted, state.runtimeConfigOverride)
    if (!state.previewConfigPatch) return { persistedConfig: persisted, config: runtimeBase, configLoaded: true }
    return { persistedConfig: persisted, config: mergeAppConfig(runtimeBase, state.previewConfigPatch), previewBaseConfig: runtimeBase, configLoaded: true }
  }),

  setRuntimeConfigOverride: (updates) => set((state) => {
    const runtimeBase = applyRuntimeConfigOverride(state.persistedConfig, updates)
    if (!state.previewConfigPatch) return { runtimeConfigOverride: updates, config: runtimeBase, configLoaded: true }
    return { runtimeConfigOverride: updates, config: mergeAppConfig(runtimeBase, state.previewConfigPatch), previewBaseConfig: runtimeBase, configLoaded: true }
  }),

  applyPreviewConfig: (updates) => set((state) => {
    const previewBase = applyRuntimeConfigOverride(state.persistedConfig, state.runtimeConfigOverride)
    return { previewBaseConfig: previewBase, previewConfigPatch: updates, config: mergeAppConfig(previewBase, updates), configLoaded: true }
  }),

  clearPreviewConfig: () => set((state) => {
    if (!state.previewBaseConfig) return { previewConfigPatch: null }
    return {
      config: applyRuntimeConfigOverride(state.persistedConfig, state.runtimeConfigOverride),
      previewBaseConfig: null,
      previewConfigPatch: null,
      configLoaded: true,
    }
  }),
})
