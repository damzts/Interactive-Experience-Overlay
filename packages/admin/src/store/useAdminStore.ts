import { create } from 'zustand'
import { STATE, DEFAULT_CONFIG } from '@ieom/shared'
import type { AppConfig } from '@ieom/shared'

interface AdminStore {
  currentState: STATE
  obsConnected: boolean
  clientCount: number
  lastError: string | null
  config: AppConfig
  configLoaded: boolean

  setCurrentState: (s: STATE) => void
  setObsConnected: (b: boolean) => void
  setClientCount: (n: number) => void
  setLastError: (e: string | null) => void
  setConfig: (c: AppConfig) => void
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

  setCurrentState: (s) => set({ currentState: s }),
  setObsConnected: (b) => set({ obsConnected: b }),
  setClientCount: (n) => set({ clientCount: n }),
  setLastError: (e) => set({ lastError: e }),
  setConfig: (c) => set({ config: c, configLoaded: true }),

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
    const merged = { ...get().config, ...updates }
    try {
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(merged),
      })
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
