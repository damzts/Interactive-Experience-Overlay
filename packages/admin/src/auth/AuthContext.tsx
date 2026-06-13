import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { apiFetch, logout as apiLogout } from '../api/client'
import { reconnectSocket } from '../socket/client'
import { isDesktopMode } from '../desktop/isDesktopMode'
import { captureAuthTokenFromLocation, clearStoredAuthToken, setStoredAuthToken, getStoredAuthToken } from './sessionToken'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthUser {
  id: string
  email: string
  name: string
}

// ---------------------------------------------------------------------------
// JWT decode helper (no signature verification — used only as fallback to
// extract user info when /api/auth/me is unreachable)
// ---------------------------------------------------------------------------

function decodeJwtPayload(token: string): AuthUser | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    if (!payload.sub || !payload.email) return null
    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name ?? payload.email.split('@')[0],
    }
  } catch {
    return null
  }
}

export interface AuthContextValue {
  isAuthenticated: boolean
  user: AuthUser | null
  isLoading: boolean
  login: () => void
  logout: () => void
  checkAuth: () => Promise<void>
  openLoginModal: () => void
  closeLoginModal: () => void
  isLoginModalOpen: boolean
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
  const [loginModalOpen, setLoginModalOpen] = useState(false)

  const isAuthenticated = user !== null

  /**
   * Calls GET /auth/me with credentials to determine auth status.
   * On success, sets the user and reconnects the socket.
   * On failure (401 or network error), clears the user.
   */
  const checkAuth = useCallback(async () => {
    console.log('[checkAuth] called')
    captureAuthTokenFromLocation()
    // Snapshot the token before the request — apiFetch may clear it on token_expired
    const currentToken = getStoredAuthToken()
    console.log('[checkAuth] currentToken in sessionStorage:', currentToken ? `${currentToken.substring(0, 20)}...` : 'null')
    try {
      console.log('[checkAuth] calling /api/auth/me...')
      const data = await apiFetch<AuthUser>('/api/auth/me')
      console.log('[checkAuth] /api/auth/me SUCCESS:', data)
      setUser(data)
      void reconnectSocket()
    } catch (err) {
      console.warn('[checkAuth] /api/auth/me FAILED:', err)
      // If /api/auth/me fails but we have a valid JWT token, decode it locally
      // as a fallback (avoids losing session when the cloud endpoint is
      // unreachable or cookies don't pass through the proxy correctly).
      if (currentToken) {
        const decoded = decodeJwtPayload(currentToken)
        console.log('[checkAuth] JWT fallback decode result:', decoded)
        if (decoded) {
          setUser(decoded)
          void reconnectSocket()
          return
        }
      }
      console.log('[checkAuth] no fallback available, setting user to null')
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
    const token = searchParams.get('token') ?? searchParams.get('access_token')
    if (searchParams.get('auth') === 'success' || token) {
      console.log('[auth:mount] detected auth=success or token in URL')
      if (token) {
        console.log('[auth:mount] storing token from URL redirect')
        setStoredAuthToken(token)
        // Clean the URL
        const url = new URL(window.location.href)
        url.searchParams.delete('token')
        url.searchParams.delete('access_token')
        url.searchParams.delete('auth')
        window.history.replaceState({}, document.title, url.pathname + url.search)
      }
      void checkAuth()
    }
  }, [checkAuth])

  const login = useCallback(() => {
    console.log('[login] starting OAuth flow')
    // Always clear old tokens and start fresh OAuth flow
    localStorage.removeItem('ieom_oauth_token')

    // Redirect the current window to the cloud OAuth endpoint.
    // The cloud will redirect back to /auth/callback with the token,
    // which main.tsx handles via OAuthCallback or the auth=success param.
    const cloudOrigin = 'https://ieom.danhub.dev'
    const callbackUrl = window.location.origin + '/?auth=success'
    const authUrl = `${cloudOrigin}/api/auth/google?redirect=${encodeURIComponent(callbackUrl)}`
    console.log('[login] redirecting to:', authUrl)
    window.location.href = authUrl
  }, [checkAuth])

  const logout = useCallback(async () => {
    clearStoredAuthToken()
    // apiLogout clears server-side session state without navigating away from the admin shell
    await apiLogout()
    setUser(null)
  }, [])

  const openLoginModal = useCallback(() => setLoginModalOpen(true), [])
  const closeLoginModal = useCallback(() => setLoginModalOpen(false), [])

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        isLoading,
        login,
        logout,
        checkAuth,
        openLoginModal,
        closeLoginModal,
        isLoginModalOpen: loginModalOpen,
      }}
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
  const [loginModalOpen, setLoginModalOpen] = useState(false)

  const isAuthenticated = user !== null

  // Subscribe to auth status changes from the main process via IPC
  useEffect(() => {
    const ieom = window.ieom

    const unsubscribe = ieom.auth.onStatusChanged((data) => {
      if (data.authenticated && data.user) {
        setUser(data.user as AuthUser)
        void reconnectSocket()
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

  const openLoginModal = useCallback(() => setLoginModalOpen(true), [])
  const closeLoginModal = useCallback(() => setLoginModalOpen(false), [])

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        isLoading,
        login,
        logout,
        checkAuth,
        openLoginModal,
        closeLoginModal,
        isLoginModalOpen: loginModalOpen,
      }}
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
