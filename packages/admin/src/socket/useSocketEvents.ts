import { useEffect } from 'react'
import { STATE } from '@ieom/shared'
import type { DesktopRuntimeStatePayload, ServerToClientEvents } from '@ieom/shared'
import { socket } from './client'
import { useAdminStore } from '../store/useAdminStore'
import { adminSignalHandlers } from './signalMap'

export function useSocketEvents() {
  const fetchConfig = useAdminStore((s) => s.fetchConfig)
  const setCurrentState = useAdminStore((s) => s.setCurrentState)
  const syncDesktopRuntimeState = useAdminStore((s) => s.syncDesktopRuntimeState)

  useEffect(() => {
    const requestRuntimeState = () => {
      socket.emit('state:request', (state: STATE) => {
        if (state && state !== STATE.TRANSITIONING) setCurrentState(state)
      })
      socket.emit('desktop:state:request', (payload: DesktopRuntimeStatePayload) => {
        syncDesktopRuntimeState(payload)
      })
    }

    fetchConfig()
    requestRuntimeState()
    socket.on('connect', requestRuntimeState)

    // Register all signal handlers from the map
    const off: Array<() => void> = []
    const store = useAdminStore.getState
    for (const [event, handler] of Object.entries(adminSignalHandlers) as Array<
      [keyof ServerToClientEvents, (payload: any, store: any) => void]
    >) {
      const wrapped = (payload: unknown) => handler(payload, store())
      socket.on(event as any, wrapped)
      off.push(() => socket.off(event as any, wrapped))
    }

    return () => {
      socket.off('connect', requestRuntimeState)
      off.forEach((fn) => fn())
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
