import { useEffect, useMemo } from 'react'
import { socket } from './socket/client'
import { useAdminStore } from './store/useAdminStore'
import { useSocketEvents } from './socket/useSocketEvents'
import { Dashboard } from './features/dashboard/Dashboard'
import { AuthProvider } from './auth/AuthContext'
import { ToastContainer, CommandPalette } from './components/organisms'
import { WelcomeTour } from './features/onboarding/WelcomeTour'
import { useToast } from './hooks/useToast'
import { useCommandPalette } from './hooks/useCommandPalette'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useOnboardingDismissed } from './hooks/useOnboardingDismissed'
import './styles/animations.css'

function AppContent() {
  useSocketEvents()
  const config = useAdminStore((s) => s.config)

  // Toast system
  const { toasts, removeToast } = useToast()

  // Onboarding tour
  const [onboardingDismissed, dismissOnboarding] = useOnboardingDismissed()

  // Command palette — uses an empty sections array for now since the
  // existing Dashboard has its own navigation. The search index will be
  // populated when the new sidebar navigation is fully wired up.
  const commandPalette = useCommandPalette({
    sections: [],
    onNavigate: () => {},
  })

  // Keyboard shortcuts — wire Ctrl+K to open command palette
  const shortcutHandlers = useMemo(
    () => ({
      onSearch: commandPalette.open,
      onEscape: commandPalette.close,
    }),
    [commandPalette.open, commandPalette.close],
  )
  useKeyboardShortcuts(shortcutHandlers)

  useEffect(() => {
    if (!socket.connected) socket.connect()
  }, [])

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
    <>
      {/* Existing dashboard with its own navigation — preserved as-is */}
      <Dashboard />

      {/* Global toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />

      {/* Command palette (Ctrl+K) */}
      <CommandPalette
        open={commandPalette.isOpen}
        onClose={commandPalette.close}
        onSelect={commandPalette.handleSelect}
        query={commandPalette.query}
        onQueryChange={commandPalette.setQuery}
        results={commandPalette.results}
        recentSearches={commandPalette.recentSearches}
        onRecentSelect={commandPalette.handleRecentSelect}
      />

      {/* Welcome tour for first-time visitors */}
      <WelcomeTour open={!onboardingDismissed} onDismiss={dismissOnboarding} />
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
