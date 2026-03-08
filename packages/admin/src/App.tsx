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

    const KEYBINDS: Record<string, STATE> = {
      F1: STATE.LOBBY,
      F2: STATE.GAMEPLAY,
      F3: STATE.TV,
      F4: STATE.MUSIC,
      F5: STATE.ARCHIVE,
    }

    const handleKey = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as Element)?.tagName)) return
      if (e.key === 'Escape') { socket.emit('panic'); return }
      const target = KEYBINDS[e.key]
      if (target) { e.preventDefault(); socket.emit('scene:change', target) }
      if (e.key === 'd') socket.emit('overlay:trigger', OVERLAY_EVENT.DEATH)
      if (e.key === 'v') socket.emit('overlay:trigger', OVERLAY_EVENT.VICTORY)
      if (e.key === 'r') socket.emit('overlay:trigger', OVERLAY_EVENT.REVIVE)
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

