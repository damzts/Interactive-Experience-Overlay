import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { apiFetch, logout as apiLogout } from '../api/client'
import { reconnectSocket } from '../socket/client'
import { isDesktopMode } from '../desktop/isDesktopMode'
import { captureAuthTokenFromLocation, clearStoredAuthToken } from './sessionToken'
import { resolveBackendUrl } from './sessionToken'

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

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    if (searchParams.get('auth') !== 'success' || !window.opener) {
      return
    }

    const closePopup = () => {
      try {
        window.opener.postMessage({ type: 'ieom-auth-success' }, window.location.origin)
        window.opener.focus()
      } catch {
        // Ignore cross-window issues and still attempt to close.
      }

      window.close()
    }

    const timer = window.setTimeout(closePopup, 0)
    return () => {
      window.clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    const handleAuthSuccessMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      if (event.data?.type !== 'ieom-auth-success') return
      void checkAuth()
    }

    window.addEventListener('message', handleAuthSuccessMessage)
    return () => {
      window.removeEventListener('message', handleAuthSuccessMessage)
    }
  }, [checkAuth])

  const login = useCallback(() => {
    const returnUrl = new URL(window.location.href)
    returnUrl.searchParams.delete('auth')
    returnUrl.searchParams.delete('error')
    returnUrl.searchParams.delete('token')
    returnUrl.searchParams.delete('access_token')

    const authUrl = resolveBackendUrl(`/api/auth/google?redirect=${encodeURIComponent(returnUrl.toString())}`)
    const popupWidth = 520
    const popupHeight = 720
    const popupLeft = Math.max(0, Math.round(window.screenX + (window.outerWidth - popupWidth) / 2))
    const popupTop = Math.max(0, Math.round(window.screenY + (window.outerHeight - popupHeight) / 2))
    const popupFeatures = [
      `width=${popupWidth}`,
      `height=${popupHeight}`,
      `left=${popupLeft}`,
      `top=${popupTop}`,
      'popup=yes',
      'toolbar=no',
      'menubar=no',
      'location=no',
      'status=no',
      'resizable=yes',
      'scrollbars=yes',
    ].join(',')

    const popup = window.open(authUrl, 'ieom-google-login', popupFeatures)
    if (popup) {
      popup.focus()
      return
    }

    window.open(authUrl, '_blank', 'noopener,noreferrer')
  }, [])

  const logout = useCallback(async () => {
    clearStoredAuthToken()
    // apiLogout clears server-side session state without navigating away from the admin shell
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
