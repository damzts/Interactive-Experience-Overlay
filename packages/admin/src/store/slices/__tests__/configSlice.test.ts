import { beforeEach, describe, expect, it, vi } from 'vitest'
import { create } from 'zustand'
import { DEFAULT_CONFIG } from '@ieomlabs/shared'
import type { AppConfig } from '@ieomlabs/shared'
import { createConfigSlice, type ConfigSlice } from '../configSlice'
import { patchConfig } from '../../../api/configApi'

vi.mock('../../../api/configApi', () => ({
  fetchConfig: vi.fn(),
  patchConfig: vi.fn(),
}))

const patchConfigMock = vi.mocked(patchConfig)

type TestStore = ConfigSlice & {
  lastError: string | null
  setLastError: (e: string | null) => void
}

function makeStore() {
  return create<TestStore>()((set, get, api) => ({
    ...createConfigSlice(set as never, get as never, api as never),
    lastError: null,
    setLastError: (e) => set({ lastError: e }),
  }))
}

function audioPatch(masterVolume: number): Partial<AppConfig> {
  return { audio: { ...DEFAULT_CONFIG.audio, masterVolume } }
}

describe('configSlice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('patchConfig merges a section into persisted and derived config', () => {
    const store = makeStore()

    store.getState().patchConfig(audioPatch(0.42))

    expect(store.getState().persistedConfig.audio.masterVolume).toBe(0.42)
    expect(store.getState().config.audio.masterVolume).toBe(0.42)
    expect(store.getState().configLoaded).toBe(true)
  })

  it('saveConfig applies the update optimistically and clears the pending list on success', async () => {
    patchConfigMock.mockResolvedValue(DEFAULT_CONFIG)
    const store = makeStore()

    await store.getState().saveConfig(audioPatch(0.42))

    expect(patchConfigMock).toHaveBeenCalledOnce()
    expect(store.getState().persistedConfig.audio.masterVolume).toBe(0.42)
    expect(store.getState()._pendingSaveUpdates).toHaveLength(0)
    expect(store.getState().lastError).toBeNull()
  })

  it('setConfig re-applies in-flight saves so a stale broadcast cannot wipe them', async () => {
    let resolvePatch!: (v: AppConfig) => void
    patchConfigMock.mockImplementation(() => new Promise((res) => { resolvePatch = res }))
    const store = makeStore()

    const save = store.getState().saveConfig(audioPatch(0.42))
    expect(store.getState()._pendingSaveUpdates).toHaveLength(1)

    // A server broadcast with a snapshot that predates the in-flight save
    store.getState().setConfig(structuredClone(DEFAULT_CONFIG))
    expect(store.getState().persistedConfig.audio.masterVolume).toBe(0.42)

    resolvePatch(DEFAULT_CONFIG)
    await save
    expect(store.getState()._pendingSaveUpdates).toHaveLength(0)
    expect(store.getState().persistedConfig.audio.masterVolume).toBe(0.42)
  })

  it('saveConfig failure clears the pending update, records the error, and rethrows', async () => {
    patchConfigMock.mockRejectedValue(new Error('boom'))
    const store = makeStore()
    const before = store.getState().persistedConfig.audio.masterVolume

    await expect(store.getState().saveConfig(audioPatch(0.42))).rejects.toThrow('boom')

    expect(store.getState()._pendingSaveUpdates).toHaveLength(0)
    expect(store.getState().lastError).toContain('boom')
    expect(store.getState().persistedConfig.audio.masterVolume).toBe(before)
  })
})
