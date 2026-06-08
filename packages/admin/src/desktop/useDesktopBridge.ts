import { useEffect, useState, useCallback, useRef } from 'react'
import { isDesktopMode } from './isDesktopMode'

// Re-export the types from the preload declarations for convenience
export interface LicenseTierData {
  tier: string
  expiresAt?: string
}

export interface AuthStatusData {
  authenticated: boolean
  user?: object
}

export interface ServerStatusData {
  running: boolean
  error?: string
}

export interface UpdateAvailableData {
  version: string
}

export interface DesktopBridge {
  /** License operations */
  license: {
    getTier(): Promise<LicenseTierData>
    tierData: LicenseTierData | null
  }
  /** Auth operations */
  auth: {
    login(): Promise<void>
    logout(): Promise<void>
    status: AuthStatusData | null
  }
  /** Server status */
  server: {
    /** Request the admin token from the main process (never exposed in URL). */
    getAdminToken(): Promise<string | null>
    status: ServerStatusData | null
  }
  /** App info */
  app: {
    getVersion(): Promise<string>
  }
  /** Update operations */
  update: {
    available: UpdateAvailableData | null
    install(): Promise<void>
  }
}

/**
 * React hook that wraps the `window.ieom` IPC API with typed methods.
 * Returns `null` if not running in desktop mode (window.ieom doesn't exist).
 *
 * Manages subscriptions (onTierChanged, onStatusChanged, etc.) with proper
 * cleanup via useEffect.
 */
export function useDesktopBridge(): DesktopBridge | null {
  const [tierData, setTierData] = useState<LicenseTierData | null>(null)
  const [authStatus, setAuthStatus] = useState<AuthStatusData | null>(null)
  const [serverStatus, setServerStatus] = useState<ServerStatusData | null>(null)
  const [updateAvailable, setUpdateAvailable] = useState<UpdateAvailableData | null>(null)

  // Track whether we're in desktop mode (stable across renders)
  const desktop = useRef(isDesktopMode())

  // Subscribe to all IPC events
  useEffect(() => {
    if (!desktop.current) return

    const ieom = window.ieom

    const unsubTier = ieom.license.onTierChanged((data) => {
      setTierData(data)
    })

    const unsubAuth = ieom.auth.onStatusChanged((data) => {
      setAuthStatus(data)
    })

    const unsubServer = ieom.server.onStatusChanged((data) => {
      setServerStatus(data)
    })

    const unsubUpdate = ieom.update.onAvailable((data) => {
      setUpdateAvailable(data)
    })

    // Fetch initial tier
    ieom.license.getTier().then(setTierData).catch(() => {})

    return () => {
      unsubTier()
      unsubAuth()
      unsubServer()
      unsubUpdate()
    }
  }, [])

  const getTier = useCallback(async (): Promise<LicenseTierData> => {
    return window.ieom.license.getTier()
  }, [])

  const login = useCallback(async (): Promise<void> => {
    return window.ieom.auth.login()
  }, [])

  const logout = useCallback(async (): Promise<void> => {
    return window.ieom.auth.logout()
  }, [])

  const getVersion = useCallback(async (): Promise<string> => {
    return window.ieom.app.getVersion()
  }, [])

  const getAdminToken = useCallback(async (): Promise<string | null> => {
    try {
      return await window.ieom.server.getAdminToken()
    } catch {
      return null
    }
  }, [])

  const install = useCallback(async (): Promise<void> => {
    return window.ieom.update.install()
  }, [])

  if (!desktop.current) {
    return null
  }

  return {
    license: {
      getTier,
      tierData,
    },
    auth: {
      login,
      logout,
      status: authStatus,
    },
    server: {
      getAdminToken,
      status: serverStatus,
    },
    app: {
      getVersion,
    },
    update: {
      available: updateAvailable,
      install,
    },
  }
}
