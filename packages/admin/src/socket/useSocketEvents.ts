import { useEffect } from 'react'
import { STATE } from '@ieom/shared'
import type { DesktopRuntimeStatePayload, ObsStatusPayload, RuntimeDiagnosticsPayload } from '@ieom/shared'
import { socket } from './client'
import { useAdminStore } from '../store/useAdminStore'

export function useSocketEvents() {
  const setCurrentState = useAdminStore((s) => s.setCurrentState)
  const setObsStatus = useAdminStore((s) => s.setObsStatus)
  const fetchConfig = useAdminStore((s) => s.fetchConfig)
  const setConfig = useAdminStore((s) => s.setConfig)
  const patchConfig = useAdminStore((s) => s.patchConfig)
  const setRuntimeConfigOverride = useAdminStore((s) => s.setRuntimeConfigOverride)
  const setCameraOwnerSocketId = useAdminStore((s) => s.setCameraOwnerSocketId)
  const syncDesktopRuntimeState = useAdminStore((s) => s.syncDesktopRuntimeState)
  const toggleWidgetRuntimeState = useAdminStore((s) => s.toggleWidgetRuntimeState)
  const setRecycleBinFull = useAdminStore((s) => s.setRecycleBinFull)
  const setSimulationLeaderId = useAdminStore((s) => s.setSimulationLeaderId)
  const setAmbianceMetrics = useAdminStore((s) => s.setAmbianceMetrics)
  const setRuntimeDiagnostics = useAdminStore((s) => s.setRuntimeDiagnostics)

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
    socket.on('state:update', ({ state }: { state: STATE }) => {
      if (state !== STATE.TRANSITIONING) setCurrentState(state)
    })
    socket.on('widget:toggle', (widgetId: string) => {
      toggleWidgetRuntimeState(widgetId)
    })
    socket.on('desktop:recycle-bin', ({ full }: { full: boolean }) => {
      setRecycleBinFull(full)
    })
    socket.on('obs:status', (payload: ObsStatusPayload) => {
      setObsStatus(payload)
    })
    socket.on('config:update', (config) => {
      setConfig(config)
    })
    socket.on('config:patch', (updates) => {
      patchConfig(updates)
    })
    socket.on('runtime:config:override', (updates) => {
      setRuntimeConfigOverride(updates)
    })
    socket.on('camera:owner', ({ socketId }: { socketId: string }) => {
      setCameraOwnerSocketId(socketId)
    })
    socket.on('ambiance:leader', ({ socketId }: { socketId: string }) => {
      setSimulationLeaderId(socketId)
    })
    socket.on('ambiance:metrics', (payload: { accepted: number; rejected: number }) => {
      setAmbianceMetrics(payload)
    })
    socket.on('runtime:diagnostics', (payload: RuntimeDiagnosticsPayload) => {
      setRuntimeDiagnostics(payload)
    })

    return () => {
      socket.off('connect', requestRuntimeState)
      socket.off('state:update')
      socket.off('widget:toggle')
      socket.off('desktop:recycle-bin')
      socket.off('obs:status')
      socket.off('config:update')
      socket.off('config:patch')
      socket.off('runtime:config:override')
      socket.off('camera:owner')
      socket.off('ambiance:leader')
      socket.off('ambiance:metrics')
      socket.off('runtime:diagnostics')
    }
  }, [
    fetchConfig,
    patchConfig,
    setAmbianceMetrics,
    setCameraOwnerSocketId,
    setConfig,
    setCurrentState,
    setObsStatus,
    setRecycleBinFull,
    setRuntimeConfigOverride,
    setRuntimeDiagnostics,
    setSimulationLeaderId,
    syncDesktopRuntimeState,
    toggleWidgetRuntimeState,
  ])
}
