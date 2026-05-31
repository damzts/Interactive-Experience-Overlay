import { useEffect } from 'react'
import { socket } from './socket/client'
import { useAdminStore } from './store/useAdminStore'
import { useSocketEvents } from './socket/useSocketEvents'
import { Dashboard } from './features/dashboard/Dashboard'
import { AuthProvider } from './auth/AuthContext'

function AppContent() {
  useSocketEvents()
  const config = useAdminStore((s) => s.config)

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

  return <Dashboard />
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
