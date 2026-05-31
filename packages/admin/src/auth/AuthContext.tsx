import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { apiFetch, logout as apiLogout } from '../api/client'
import { reconnectSocket } from '../socket/client'
import { isDesktopMode } from '../desktop/isDesktopMode'
import { captureAuthTokenFromLocation, clearStoredAuthToken } from './sessionToken'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthUser {
  id: string
  email: string
  name: string
}

export interface AuthContextValue {
  isAuthenticated: boolean
  user: AuthUser | null
  isLoading: boolean
  login: () => void
  logout: () => void
  checkAuth: () => Promise<void>
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextValue | null>(null)

// ---------------------------------------------------------------------------
// Web Provider (cookie-based, used in non-desktop mode)
// ---------------------------------------------------------------------------

function WebAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const isAuthenticated = user !== null

  /**
   * Calls GET /auth/me with credentials to determine auth status.
   * On success, sets the user and reconnects the socket.
   * On failure (401 or network error), clears the user.
   */
  const checkAuth = useCallback(async () => {
    try {
      captureAuthTokenFromLocation()

      const data = await apiFetch<AuthUser>('/api/auth/me')
      setUser(data)
      reconnectSocket()
    } catch {
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Check auth status on mount
  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  const login = useCallback(() => {
    window.location.href = `/api/auth/google?redirect=${encodeURIComponent(window.location.origin + '/admin')}`
  }, [])

  const logout = useCallback(async () => {
    clearStoredAuthToken()
    // apiLogout handles the POST /auth/logout call and redirects to /admin/login
    await apiLogout()
  }, [])

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, user, isLoading, login, logout, checkAuth }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Desktop Provider (IPC-based, used when window.ieom is present)
// ---------------------------------------------------------------------------

function DesktopAuthProviderInternal({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const isAuthenticated = user !== null

  // Subscribe to auth status changes from the main process via IPC
  useEffect(() => {
    const ieom = window.ieom

    const unsubscribe = ieom.auth.onStatusChanged((data) => {
      if (data.authenticated && data.user) {
        setUser(data.user as AuthUser)
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
    // In desktop mode, auth state is pushed via IPC events from the main process.
    // This is effectively a no-op since the main process drives auth state.
  }, [])

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, user, isLoading, login, logout, checkAuth }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Unified Provider — delegates to Desktop or Web based on environment
// ---------------------------------------------------------------------------

/**
 * AuthProvider that automatically detects the runtime environment.
 * In desktop mode (window.ieom present), uses IPC-based auth via the desktop provider.
 * In web mode, uses the traditional cookie-based auth flow.
 *
 * Both providers write to the same AuthContext, so `useAuth()` works identically
 * regardless of the runtime environment.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  if (isDesktopMode()) {
    return <DesktopAuthProviderInternal>{children}</DesktopAuthProviderInternal>
  }
  return <WebAuthProvider>{children}</WebAuthProvider>
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
