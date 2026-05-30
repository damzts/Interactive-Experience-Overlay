import { useEffect } from 'react'
import { socket } from './socket/client'
import { useAdminStore } from './store/useAdminStore'
import { useSocketEvents } from './socket/useSocketEvents'
import { Dashboard } from './features/dashboard/Dashboard'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { LoginPage } from './auth/LoginPage'

function AuthenticatedApp() {
  useSocketEvents()
  const { user, logout } = useAuth()

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

  return (
    <div className="admin-shell h-full relative">
      <div className="absolute right-4 top-4 z-50 flex items-center gap-3 rounded-lg border border-zinc-700/80 bg-zinc-900/90 px-3 py-2 shadow-lg backdrop-blur">
        <div className="text-right">
          <div className="text-xs font-medium text-zinc-100 leading-tight">
            {user?.name || user?.email || 'Authenticated'}
          </div>
          <div className="text-[11px] text-zinc-400 leading-tight">
            {user?.email || user?.id || 'Session active'}
          </div>
        </div>
        <button
          type="button"
          onClick={logout}
          className="rounded-md border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-100 hover:bg-zinc-700"
        >
          Logout
        </button>
      </div>
      <Dashboard />
    </div>
  )
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return null
  }

  return isAuthenticated ? <AuthenticatedApp /> : <LoginPage />
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
