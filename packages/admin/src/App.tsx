import { useEffect } from 'react'
import { STATE, OVERLAY_EVENT } from '@ieom/shared'
import { socket } from './socket/client'
import { useAdminStore } from './store/useAdminStore'
import { Dashboard } from './components/Dashboard'

export default function App() {
  const setCurrentState = useAdminStore((s) => s.setCurrentState)
  const setObsConnected = useAdminStore((s) => s.setObsConnected)
  const fetchConfig = useAdminStore((s) => s.fetchConfig)
  const setConfig = useAdminStore((s) => s.setConfig)

  useEffect(() => {
    fetchConfig()

    socket.emit('state:request', (state: STATE) => {
      if (state && state !== STATE.TRANSITIONING) setCurrentState(state)
    })

    socket.on('state:update', ({ state }: { state: STATE }) => {
      if (state !== STATE.TRANSITIONING) setCurrentState(state)
    })

    socket.on('obs:status', ({ connected }: { connected: boolean }) => {
      setObsConnected(connected)
    })

    socket.on('config:update', (config) => {
      setConfig(config)
    })

    const handleKey = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as Element)?.tagName)) return
      if (e.key === 'Escape') { socket.emit('panic'); return }
      if (e.key === 'F1') { e.preventDefault(); socket.emit('scene:change', STATE.GAMEPLAY); return }
      if (e.key === 'F2') { e.preventDefault(); socket.emit('overlay:trigger', OVERLAY_EVENT.DEATH); return }
      if (e.key === 'F3') { e.preventDefault(); socket.emit('overlay:trigger', OVERLAY_EVENT.REVIVE); return }
      if (e.key === 'F4') { e.preventDefault(); socket.emit('overlay:trigger', OVERLAY_EVENT.VICTORY); return }
      if (e.key === 'F5') { e.preventDefault(); socket.emit('scene:change', STATE.TV); return }
      if (e.key === 'F6') { e.preventDefault(); socket.emit('scene:change', STATE.LOBBY); return }
    }

    window.addEventListener('keydown', handleKey)
    return () => {
      socket.off('state:update')
      socket.off('obs:status')
      socket.off('config:update')
      window.removeEventListener('keydown', handleKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <Dashboard />
}

