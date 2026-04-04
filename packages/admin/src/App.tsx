import { useEffect } from 'react'
import { STATE, type DesktopRuntimeStatePayload, type ObsStatusPayload, type RuntimeDiagnosticsPayload } from '@ieom/shared'
import { socket } from './socket/client'
import { useAdminStore } from './store/useAdminStore'
import { Dashboard } from './components/Dashboard'

export default function App() {
  const setCurrentState = useAdminStore((s) => s.setCurrentState)
  const setObsStatus = useAdminStore((s) => s.setObsStatus)
  const fetchConfig = useAdminStore((s) => s.fetchConfig)
  const setConfig = useAdminStore((s) => s.setConfig)
  const patchConfig = useAdminStore((s) => s.patchConfig)
  const setRuntimeConfigOverride = useAdminStore((s) => s.setRuntimeConfigOverride)
  const syncDesktopRuntimeState = useAdminStore((s) => s.syncDesktopRuntimeState)
  const toggleWidgetRuntimeState = useAdminStore((s) => s.toggleWidgetRuntimeState)
  const setRecycleBinFull = useAdminStore((s) => s.setRecycleBinFull)
  const setSimulationLeaderId = useAdminStore((s) => s.setSimulationLeaderId)
  const setAmbianceMetrics = useAdminStore((s) => s.setAmbianceMetrics)
  const setRuntimeDiagnostics = useAdminStore((s) => s.setRuntimeDiagnostics)
  const config = useAdminStore((s) => s.config)

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

    socket.on('widget:toggle', (widgetId) => {
      toggleWidgetRuntimeState(widgetId)
    })

    socket.on('desktop:recycle-bin', ({ full }) => {
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

    socket.on('ambiance:leader', ({ socketId }) => {
      setSimulationLeaderId(socketId)
    })

    socket.on('ambiance:metrics', (payload) => {
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
      socket.off('ambiance:leader')
      socket.off('ambiance:metrics')
      socket.off('runtime:diagnostics')
    }
  }, [fetchConfig, patchConfig, setAmbianceMetrics, setConfig, setCurrentState, setObsStatus, setRecycleBinFull, setRuntimeConfigOverride, setRuntimeDiagnostics, setSimulationLeaderId, syncDesktopRuntimeState, toggleWidgetRuntimeState])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as Element)?.tagName)) return
      const key = e.key === ' ' ? 'Space' : e.key
      const scope = config.keybinds.admin[key]
        ? 'admin'
        : config.keybinds.obs[key]
          ? 'obs'
          : null
      if (!scope) return
      e.preventDefault()
      socket.emit('keybind:execute', { scope, key })
    }

    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('keydown', handleKey)
    }
  }, [config])

  return (
    <div className="admin-shell h-full">
      <Dashboard />
    </div>
  )
}

