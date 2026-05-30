import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { reconnectSocket } from '../socket/client'
import type { AuthContextValue, AuthUser } from '../auth/AuthContext'
import { isDesktopMode } from './isDesktopMode'

// ---------------------------------------------------------------------------
// Context (reuses the same shape as the web AuthContext)
// ---------------------------------------------------------------------------

const DesktopAuthContext = createContext<AuthContextValue | null>(null)

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/**
 * Desktop-aware AuthContext provider that uses `window.ieom.auth` IPC
 * instead of cookie-based HTTP auth. Provides the same interface as the
 * web AuthContext so all downstream components work in both modes.
 */
export function DesktopAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const isAuthenticated = user !== null

  // Subscribe to auth status changes from the main process
  useEffect(() => {
    if (!isDesktopMode()) {
      setIsLoading(false)
      return
    }

    const ieom = window.ieom

    const unsubscribe = ieom.auth.onStatusChanged((data) => {
      if (data.authenticated && data.user) {
        const authUser = data.user as AuthUser
        setUser(authUser)
        reconnectSocket()
      } else {
        setUser(null)
      }
      setIsLoading(false)
    })

    return () => {
      unsubscribe()
    }
  }, [])

  const login = useCallback(() => {
    // Initiates OAuth flow via IPC — opens system browser
    window.ieom.auth.login()
  }, [])

  const logout = useCallback(async () => {
    await window.ieom.auth.logout()
    setUser(null)
  }, [])

  const checkAuth = useCallback(async () => {
    // In desktop mode, auth state is pushed via IPC events.
    // This is a no-op since the main process drives auth state.
  }, [])

  return (
    <DesktopAuthContext.Provider
      value={{ isAuthenticated, user, isLoading, login, logout, checkAuth }}
    >
      {children}
    </DesktopAuthContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDesktopAuth(): AuthContextValue {
  const ctx = useContext(DesktopAuthContext)
  if (!ctx) {
    throw new Error('useDesktopAuth must be used within a DesktopAuthProvider')
  }
  return ctx
}
