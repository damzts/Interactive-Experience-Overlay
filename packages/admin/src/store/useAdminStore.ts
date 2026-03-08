import { create } from 'zustand'
import { STATE } from '@ieom/shared'

interface AdminStore {
  currentState: STATE
  obsConnected: boolean
  clientCount: number
  lastError: string | null

  setCurrentState: (s: STATE) => void
  setObsConnected: (b: boolean) => void
  setClientCount: (n: number) => void
  setLastError: (e: string | null) => void
}

export const useAdminStore = create<AdminStore>((set) => ({
  currentState: STATE.LOBBY,
  obsConnected: false,
  clientCount: 0,
  lastError: null,

  setCurrentState: (s) => set({ currentState: s }),
  setObsConnected: (b) => set({ obsConnected: b }),
  setClientCount: (n) => set({ clientCount: n }),
  setLastError: (e) => set({ lastError: e }),
}))
